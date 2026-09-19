import * as domain from '@vidya/domain'
import { Course, Enrollment } from '@vidya/entities'
import { PushChange } from '@vidya/protocol'
import { EntityManager } from 'typeorm'

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

/** The one status a device may bring about. Every other one is a decision. */
const REQUESTED: domain.EnrollmentStatus = 'pending'

const find = async (manager: EntityManager, change: PushChange): Promise<Enrollment | null> =>
  isUuid(change.docId)
    ? manager.findOneBy(Enrollment, { id: change.docId as domain.EnrollmentId })
    : null

/**
 * A student asking to join a course, from a device that was offline.
 *
 * `enrollments` replicates both ways — up goes the request, down comes the
 * decision (`SYNC_DIRECTION`) — so a request written on a train is a row the
 * server has to be able to take.
 * Refusing it would strand an outbox row that is never deleted and never
 * accepted, which is a permanent, and false, refusal sitting in the app.
 *
 * The rules are `EnrollmentsService.request`'s, applied here rather than
 * borrowed, because a push runs inside its own transaction:
 *
 * - the place asked for is the caller's own, or there is nothing to write;
 * - the course has to exist, which is the whole of what `POST /edu/enrollments`
 *   asks of it — access to a course *comes from* being enrolled, so there is no
 *   further permission a student could be missing here;
 * - a student already holding a row on that course keeps it exactly as it is.
 *
 * **A request that meets a decision is answered, not refused.** Accepted, and
 * declined too: the school has spoken, the server owns `status`, and a refusal
 * would put back the undeletable rejected row this applier exists to remove.
 * A declined student asking again is a new request, made online against a row
 * the school can see — not the replay of one written before the answer came.
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

    return { course, body: requestBody(change.data) }
  },

  // Nothing here is frozen, because nothing here is overwritten: a request that
  // arrives after the school has decided changes no field, and is answered as
  // the repeat it is rather than refused.
  async editable(): Promise<Rejection | null> {
    return null
  },

  async apply(
    manager: EntityManager,
    change: PushChange,
    prepared: PreparedRow,
    context: PushRowContext,
  ): Promise<string> {
    const existing = await locate(manager, change, prepared, context)

    // Already asked, or already decided. Either way the row stands as it is and
    // the push has nothing to add — writing would only restate `pending` over
    // an answer the school gave. Its id is the answer: a student who asked from
    // two devices has one place, under the name the first of them gave it.
    if (existing) return existing.id

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
        // When the request reached the school, by the server's clock. The moment
        // the student tapped is the HLC the row is journalled under.
        createdAt: new Date(context.now),
      }),
    )

    return change.docId
  },
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

/**
 * The row the student already holds on this course, whatever it is called.
 *
 * A device names the request itself, so the id it sends and the id an online
 * request left behind are two names for one place. `(courseId, studentId)` is
 * unique, and writing under the second name would fail that constraint and lose
 * the decision stored under the first.
 */
const locate = async (
  manager: EntityManager,
  change: PushChange,
  prepared: PreparedRow,
  context: PushRowContext,
): Promise<Enrollment | null> => {
  const byId = await find(manager, change)

  if (byId) return byId

  return manager.findOneBy(Enrollment, {
    courseId: prepared.course.id,
    studentId: context.userId,
  })
}

/**
 * What the device actually asked for.
 *
 * `FIELD_OWNER.enrollments.client` is `['status']`, so the decision, the group
 * and the times are dropped from whatever arrived without a word — the
 * device must not have to know the server's model to send a row it wrote
 * itself. And the only status a client may bring about is `pending`, so a row
 * claiming another is not refused either: it is read as the request it is.
 */
const requestBody = (data: domain.SyncPayload | null): domain.SyncPayload => ({
  ...ownedBy('enrollments', data ?? {}),
  status: REQUESTED,
})
