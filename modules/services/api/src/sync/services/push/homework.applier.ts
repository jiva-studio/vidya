import * as domain from '@vidya/domain'
import { Homework } from '@vidya/entities'
import { PushChange } from '@vidya/protocol'
import { EntityManager } from 'typeorm'

import { isSuperseded, isUuid, refsFrom, resolveAccess } from './access'
import {
  isRejection,
  ownedBy,
  PreparedRow,
  PushApplier,
  PushRowContext,
  reject,
  Rejection,
} from './types'

/**
 * The one status a student can never write over.
 *
 * Not the whole freeze that `HomeworkService` applies: an answer still on its
 * way through review may be corrected from a device, because a batch is allowed
 * to carry two edits of one document and the second must land. Accepted
 * is final, and the only status whose refusal the contract has a word for.
 */
const FINAL = 'accepted'

const instant = (value: unknown): Date | null =>
  value === null || value === undefined ? null : new Date(String(value))

const isInstant = (value: unknown): boolean =>
  value === null || value === undefined || !Number.isNaN(Date.parse(String(value)))

const find = async (manager: EntityManager, change: PushChange): Promise<Homework | null> =>
  isUuid(change.docId)
    ? manager.findOneBy(Homework, { id: change.docId as domain.HomeworkId })
    : null

/**
 * A student's answer, arriving from a device.
 *
 * The rules are `HomeworkService`'s, applied here rather than borrowed, because
 * a push runs inside its own transaction and that service writes through its own
 * repository. They are the same two rules: the client may only ever ask for
 * `pending`, and an answer is frozen once it is handed in.
 *
 * The server fields — `status`, `grade`, `reviewedById`, `reviewedAt` — are
 * dropped from whatever the client sent without a word. Refusing a row
 * for carrying them would mean demanding that the device know the server's
 * model before it may send a row it wrote itself.
 */
export const homeworkApplier: PushApplier = {
  collection: 'homework',

  async prepare(
    manager: EntityManager,
    change: PushChange,
    context: PushRowContext,
  ): Promise<PreparedRow | Rejection> {
    const existing = await find(manager, change)
    const refs = existing
      ? { enrollmentId: existing.enrollmentId, lessonVersionId: existing.lessonVersionId }
      : refsFrom(change.data)

    if (isRejection(refs)) return refs

    const access = await resolveAccess(manager, refs, context.userId)

    if (isRejection(access)) return access

    const body = validate(change.data, Boolean(existing))

    if (isRejection(body)) return body

    return { access, body }
  },

  async editable(manager: EntityManager, change: PushChange): Promise<Rejection | null> {
    const existing = await find(manager, change)

    if (!existing || existing.status !== FINAL) return null

    return reject('alreadyAccepted', 'the work has been accepted and its text is frozen')
  },

  async apply(
    manager: EntityManager,
    change: PushChange,
    prepared: PreparedRow,
    context: PushRowContext,
  ): Promise<string> {
    const entity = await locate(manager, change, prepared)

    // Handed in, so `pending` — the only status a client may bring about — and
    // flagged when the text it answers has since been revised.
    entity.status = 'pending'
    entity.answeredSupersededVersion = await isSuperseded(manager, prepared.access.version)
    entity.updatedAt = new Date(context.now)
    entity.text = (prepared.body.text as string) ?? entity.text ?? ''
    entity.submittedAt =
      'submittedAt' in prepared.body
        ? instant(prepared.body.submittedAt)
        : (entity.submittedAt ?? new Date(context.now))

    await manager.save(Homework, entity)

    // The row the natural key held, when that is not the one the device named.
    return entity.id
  },
}

/**
 * The row to write: the one this document names, or the one the natural key
 * already holds.
 *
 * A device generates the id for work it writes offline, so two devices of one
 * student can hand in the same section under two ids. The table's unique key is
 * `(enrolment, version, section)`, so the second id would fail the insert and
 * the student would lose the answer they wrote last. Writing the row the key
 * already points at keeps both answers' text and lets the ordinary HLC
 * tiebreak decide, which is what it is for.
 */
const locate = async (
  manager: EntityManager,
  change: PushChange,
  prepared: PreparedRow,
): Promise<Homework> => {
  const byId = await find(manager, change)

  if (byId) return byId

  const sectionId = domain.asId<domain.SectionId>(String(change.data?.sectionId))
  const natural = await manager.findOneBy(Homework, {
    enrollmentId: prepared.access.enrollment.id,
    lessonVersionId: prepared.access.version.id,
    sectionId,
  })

  if (natural) return natural

  return manager.create(Homework, {
    id: domain.asId<domain.HomeworkId>(change.docId),
    enrollmentId: prepared.access.enrollment.id,
    lessonVersionId: prepared.access.version.id,
    sectionId,
    schoolId: prepared.access.enrollment.schoolId,
    text: '',
    grade: null,
    reviewedById: null,
    reviewedAt: null,
    answeredSupersededVersion: false,
  })
}

/** The body a device may send: its own two fields, and an identity when the row is new. */
const validate = (
  data: domain.SyncPayload | null,
  exists: boolean,
): domain.SyncPayload | Rejection => {
  if (!data) return reject('malformed', 'an answer carries a body')

  if (typeof data.text !== 'string' && !(exists && data.text === undefined)) {
    return reject('malformed', 'text must be a string')
  }

  if (!isInstant(data.submittedAt)) {
    return reject('malformed', 'submittedAt must be an instant')
  }

  if (!exists && !isUuid(data.sectionId)) {
    return reject('malformed', 'a new answer must name its section')
  }

  return ownedBy('homework', data)
}
