import * as domain from '@vidya/domain'
import { Course, Enrollment, Group } from '@vidya/entities'
import { PushChange } from '@vidya/protocol'
import { EntityManager, In } from 'typeorm'

import { isUuid } from './access'
import {
  isRejection,
  ownedBy,
  PreparedRow,
  PushApplier,
  PushRowContext,
  reject,
  Rejection,
} from './types'

/** The one status a device may ask for. Every other one is a decision. */
const REQUESTED: domain.EnrollmentStatus = 'pending'

/** The one status a device may bring about on a place it already holds. */
const GIVEN_BACK: domain.EnrollmentStatus = 'withdrawn'

const find = async (manager: EntityManager, change: PushChange): Promise<Enrollment | null> =>
  isUuid(change.docId)
    ? manager.findOneBy(Enrollment, { id: change.docId as domain.EnrollmentId })
    : null

const instant = (value: unknown): Date | null =>
  value === null || value === undefined ? null : new Date(String(value))

// A stored instant is a `Date` and a pushed one an ISO string, and rendering
// the first as text would drop its milliseconds before the two ever met.
const moment = (value: unknown): number | null => {
  if (value === null || value === undefined) return null

  return value instanceof Date ? value.getTime() : Date.parse(String(value))
}

/**
 * A student asking to join a course, and everything they do with that place
 * afterwards, from a device that was offline.
 *
 * `enrollments` replicates both ways — up goes the request, down comes the
 * decision (`SYNC_DIRECTION`) — so a request written on a train is a row the
 * server has to be able to take, and so is the cancellation, the departure and
 * the putting away that may follow it.
 * Refusing one would strand an outbox row that is never deleted and never
 * accepted, which is a permanent, and false, refusal sitting in the app.
 *
 * The rules are `EnrollmentsService.request`'s, applied here rather than
 * borrowed, because a push runs inside its own transaction:
 *
 * - the place asked for is the caller's own, or there is nothing to write;
 * - the course has to exist, which is the whole of what `POST /edu/enrollments`
 *   asks of it — access to a course *comes from* being enrolled, so there is no
 *   further permission a student could be missing here;
 * - a group may only be wished for on the course being asked for.
 *
 * **A request that meets a decision is answered, not refused**, as long as the
 * device knew of that decision when it wrote: a row echoing the stored
 * `decidedAt` was written in full knowledge and is applied. One echoing another
 * moment was written behind the school's back, and only `alreadyAccepted` lets
 * the device drop its copy and take the server's.
 */
export const enrollmentsApplier: PushApplier = {
  collection: 'enrollments',

  async prepare(
    manager: EntityManager,
    change: PushChange,
    context: PushRowContext,
  ): Promise<PreparedRow | Rejection> {
    if (!isUuid(change.docId)) {
      return reject('malformed', 'a request names itself with a uuid')
    }

    const existing = await find(manager, change)

    if (!mayWrite(existing, change.data, context.userId)) {
      return reject('notYourEnrollment', 'a device may only ask for a place of its own')
    }

    const course = await courseOf(manager, existing, change.data)

    if (isRejection(course)) return course

    const wish = await checkWishes(manager, course, change.data)

    if (wish) return wish

    return { course, body: requestBody(change.data, existing) }
  },

  /**
   * Whether the device wrote this row knowing where the place stood.
   *
   * The order is fixed. A device that has fallen behind is answered first,
   * because the same push — a finished status on a row the school has since
   * brought back to life — would otherwise fail an invariant with `malformed`,
   * and a `malformed` row keeps its local copy over the server's for good.
   */
  async editable(manager: EntityManager, change: PushChange): Promise<Rejection | null> {
    const existing = await find(manager, change)

    if (!existing) return checkNames(change.data)

    return checkKnowledge(existing, change.data) ?? checkPutAway(existing, change.data)
  },

  async apply(
    manager: EntityManager,
    change: PushChange,
    prepared: PreparedRow,
    context: PushRowContext,
  ): Promise<string> {
    const stored = await find(manager, change)

    if (stored) return write(manager, stored, prepared.body)

    const live = await locate(manager, prepared, context)

    // The same request under a second name: a student who asked from two
    // devices has one place, under the name the first of them gave it.
    if (live) return live.id

    await manager.save(
      Enrollment,
      manager.create(Enrollment, {
        id: domain.asId<domain.EnrollmentId>(change.docId),
        courseId: prepared.course.id,
        studentId: context.userId,
        schoolId: prepared.course.schoolId,
        status: REQUESTED,
        groupId: null,
        decidedById: null,
        decidedAt: null,
        preferredGroupId: (prepared.body.preferredGroupId as domain.GroupId) ?? null,
        preferredTimes: (prepared.body.preferredTimes as domain.PreferredTimes) ?? null,
        comment: (prepared.body.comment as string) ?? null,
        archivedByStudentAt: null,
        // When the request reached the school, by the server's clock. The moment
        // the student tapped is the HLC the row is journalled under.
        createdAt: new Date(context.now),
      }),
    )

    return change.docId
  },
}

/** The fields the student owns, written onto the row the push names. */
const write = async (
  manager: EntityManager,
  stored: Enrollment,
  body: domain.SyncPayload,
): Promise<string> => {
  if ('preferredGroupId' in body) stored.preferredGroupId = body.preferredGroupId as domain.GroupId
  if ('preferredTimes' in body) stored.preferredTimes = body.preferredTimes as domain.PreferredTimes
  if ('comment' in body) stored.comment = body.comment as string
  if ('archivedByStudentAt' in body) stored.archivedByStudentAt = instant(body.archivedByStudentAt)

  stored.status = body.status as domain.EnrollmentStatus

  // A student who hands the place back does not stay in the group they held.
  if (!domain.isLive(stored.status)) stored.groupId = null

  await manager.save(Enrollment, stored)

  return stored.id
}

/**
 * Whether the caller may write this row.
 *
 * A device speaks for one student, so a row that names another is refused
 * whether it is new or stored — and a new row that names nobody is refused too,
 * because a request no one signed is not this caller's to make.
 */
const mayWrite = (
  existing: Enrollment | null,
  data: domain.SyncPayload | null,
  userId: domain.UserId,
): boolean => {
  const claimed = data?.studentId

  if (claimed !== undefined && claimed !== userId) return false

  return existing ? existing.studentId === userId : claimed === userId
}

/**
 * The course the request is for.
 *
 * A stored row takes it from the table: identity is written once and never
 * merged, so a client repeating a different `courseId` on a row that exists is
 * repeating it at nothing.
 */
const courseOf = async (
  manager: EntityManager,
  existing: Enrollment | null,
  data: domain.SyncPayload | null,
): Promise<Course | Rejection> => {
  const courseId = existing ? existing.courseId : data?.courseId

  if (!isUuid(courseId)) {
    return reject('malformed', 'a request names the course it asks to join')
  }

  const course = await manager.findOneBy(Course, { id: domain.asId<domain.CourseId>(courseId) })

  if (!course) {
    return reject('malformed', 'the requested course does not exist')
  }

  return course
}

/** What the student asked for besides the place itself. */
const checkWishes = async (
  manager: EntityManager,
  course: Course,
  data: domain.SyncPayload | null,
): Promise<Rejection | null> => checkTimes(data) ?? (await checkGroup(manager, course, data))

/**
 * A set of ranges the school can read, or none at all.
 *
 * Nothing is salvaged from a body that fails: a half-understood wish written
 * into the row would be a request the student never made.
 */
const checkTimes = (data: domain.SyncPayload | null): Rejection | null => {
  const times = data?.preferredTimes

  if (times === undefined || times === null) return null

  if (domain.isValidPreferredTimes(times)) return null

  return reject('malformed', 'the times asked for are not a set of ranges')
}

/**
 * The group wished for, which has to be one of this course's.
 *
 * The rule is `EnrollmentsService.assertGroupBelongsToCourse`'s, repeated here
 * rather than called, because that one runs through another service while a
 * push holds its own transaction: placing a student in a group of a different
 * course would give them a place on a course they never applied to.
 *
 * Whether the group is still taking anyone is deliberately not asked. The wish
 * outlives the intake: a school that has closed a group places the student
 * somewhere else, and refusing the request instead would lose it over a race
 * with a curator.
 */
const checkGroup = async (
  manager: EntityManager,
  course: Course,
  data: domain.SyncPayload | null,
): Promise<Rejection | null> => {
  const groupId = data?.preferredGroupId

  if (groupId === undefined || groupId === null) return null

  if (!isUuid(groupId)) return reject('malformed', 'a preferred group is named with a uuid')

  const group = await manager.findOneBy(Group, { id: domain.asId<domain.GroupId>(groupId) })

  if (!group || group.courseId !== course.id) {
    return reject('malformed', 'a preferred group belongs to the course being asked for')
  }

  return null
}

/**
 * Whether the device wrote this row knowing the decision that stands on it.
 *
 * A cancellation that went stale on a phone and a deliberate departure arrive
 * as the same pair of statuses, so the pair cannot tell them apart. What can is
 * the decision the device echoes back: the same moment means it wrote knowing
 * where the place stood, a different one means it wrote before the school
 * spoke. Two server moments, compared by value — the clock of neither side
 * takes part, and a stored `Date` never equals the string it travels as.
 */
const checkKnowledge = (
  existing: Enrollment,
  data: domain.SyncPayload | null,
): Rejection | null => {
  if (!data) return null

  if (moment(existing.decidedAt) === moment(data.decidedAt)) return null

  return reject('alreadyAccepted', 'the school has answered since this row left the device')
}

/**
 * A push that is not a new request, naming a row the server does not hold.
 *
 * Within one batch a device can have its first row resolved onto a place the
 * server already stores, and send the second under a name the server never
 * learns. Creating a place for it would invent a request nobody made;
 * `alreadyAccepted` is the one answer that makes the device take the server's
 * row, learn its real name and act on it again.
 */
const checkNames = (data: domain.SyncPayload | null): Rejection | null => {
  const status = data?.status
  const finished = typeof status === 'string' && !domain.isLive(status as domain.EnrollmentStatus)

  if (!finished && (data?.archivedByStudentAt ?? null) === null) return null

  return reject('alreadyAccepted', 'the place this row speaks of is not the one the server holds')
}

/**
 * Only a finished request may be put away, and the status this very push leaves
 * behind is the one that counts: leaving a course sets the status and the stamp
 * in one write, and reading the stored status would refuse it.
 */
const checkPutAway = (existing: Enrollment, data: domain.SyncPayload | null): Rejection | null => {
  if ((data?.archivedByStudentAt ?? null) === null) return null

  if (!domain.isLive(resultingStatus(existing, data))) return null

  return reject('malformed', 'a request still open cannot be put away')
}

/**
 * The live place the student holds on this course, whatever it is called.
 *
 * A device names the request itself, so the id it sends and the id an online
 * request left behind are two names for one place. Only live rows answer:
 * finished ones are a history the student may add to, and writing onto one of
 * them would restate an answer the school has already given.
 */
const locate = async (
  manager: EntityManager,
  prepared: PreparedRow,
  context: PushRowContext,
): Promise<Enrollment | null> =>
  manager.findOne(Enrollment, {
    where: {
      courseId: prepared.course.id,
      studentId: context.userId,
      status: In([...domain.LiveEnrollmentStatuses]),
    },
    order: { createdAt: 'DESC' },
  })

/**
 * What the device actually asked for.
 *
 * `FIELD_OWNER.enrollments.client` names the fields it may write, so the
 * decision and the group assigned are dropped from whatever arrived without a
 * word — the device must not have to know the server's model to send a row it
 * wrote itself.
 */
const requestBody = (
  data: domain.SyncPayload | null,
  existing: Enrollment | null,
): domain.SyncPayload => ({
  ...ownedBy('enrollments', data ?? {}),
  status: resultingStatus(existing, data),
})

/**
 * The status this push leaves on the row.
 *
 * A new row is a request, and nothing else. A stored one keeps the status it
 * has unless the student hands the place back: every other status is the
 * school's answer, and a replayed outbox row claiming one would put `pending`
 * back over a decision.
 */
const resultingStatus = (
  existing: Enrollment | null,
  data: domain.SyncPayload | null,
): domain.EnrollmentStatus => {
  if (!existing) return REQUESTED

  return data?.status === GIVEN_BACK ? GIVEN_BACK : existing.status
}
