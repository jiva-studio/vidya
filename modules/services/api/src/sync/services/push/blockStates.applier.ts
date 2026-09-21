import * as domain from '@vidya/domain'
import { BlockState } from '@vidya/entities'
import { PushChange } from '@vidya/protocol'
import { EntityManager } from 'typeorm'

import { isUuid, refsFrom, resolveAccess } from './access'
import { markAnswer } from './quizGrading'
import {
  isRejection,
  ownedBy,
  PreparedRow,
  PushApplier,
  PushRowContext,
  reject,
  Rejection,
} from './types'

/** What a block state may say, by the type of block it belongs to. */
const SHAPES: Record<string, readonly string[]> = {
  video: ['watched', 'duration'],
  audio: ['listened', 'duration'],
  quiz: ['answer'],
  text: ['read'],
}

const isBlockState = (value: unknown): value is domain.LessonBlockState => {
  if (typeof value !== 'object' || value === null) return false

  const state = value as Record<string, unknown>
  const fields = SHAPES[String(state.type)]

  return Boolean(fields) && fields.every((field) => state[field] !== undefined)
}

const find = async (manager: EntityManager, change: PushChange): Promise<BlockState | null> =>
  isUuid(change.docId)
    ? manager.findOneBy(BlockState, { id: change.docId as domain.BlockStateId })
    : null

/**
 * The row this change acts on: the one it names, or the one its natural key
 * already holds.
 *
 * A device names a row it wrote offline, and the same block answered on a
 * second device arrives under a second name. The checks and the write belong to
 * the row the key points at, or one attempt per block would mean one attempt
 * per identifier a device cares to invent.
 */
const rowFor = async (manager: EntityManager, change: PushChange): Promise<BlockState | null> => {
  const byId = await find(manager, change)

  if (byId) return byId

  const refs = refsFrom(change.data)

  if (isRejection(refs) || !isUuid(change.data?.blockId)) return null

  return manager.findOneBy(BlockState, {
    enrollmentId: refs.enrollmentId,
    lessonVersionId: refs.lessonVersionId,
    blockId: domain.asId<domain.BlockId>(String(change.data.blockId)),
  })
}

/**
 * How far a student got through one block, and what the server makes of it.
 *
 * The answer is the student's and the verdict on it is not: the key lives on
 * this side alone, so a quiz is marked as it arrives and the mark travels back
 * down. That is also why an answer is given once — an unlimited retry hands out
 * the key one wrong answer at a time.
 */
export const blockStatesApplier: PushApplier = {
  collection: 'block_states',

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

  /**
   * Progress is never frozen — a student may rewatch a video after the homework
   * on that lesson has been marked — but a marked question is spent.
   *
   * A resend never reaches here: the push answers a repeated stamp with a
   * repeated body from the journal, so the only thing refused is an answer the
   * student did not give before.
   */
  async editable(manager: EntityManager, change: PushChange): Promise<Rejection | null> {
    const existing = await rowFor(manager, change)

    if (!existing?.verdict) return null

    return reject('alreadyMarked', 'the question has been answered and marked')
  },

  async apply(
    manager: EntityManager,
    change: PushChange,
    prepared: PreparedRow,
    context: PushRowContext,
  ): Promise<string> {
    const entity = await locate(manager, change, prepared)

    entity.state = prepared.body.state as domain.LessonBlockState
    entity.updatedAt = new Date(context.now)

    await manager.save(BlockState, entity)
    await markAnswer(manager, entity, prepared.access.version, new Date(context.now))

    // The row the natural key held, when that is not the one the device named.
    return entity.id
  },
}

/** The row to write: the one this change acts on, or a new one under its name. */
const locate = async (
  manager: EntityManager,
  change: PushChange,
  prepared: PreparedRow,
): Promise<BlockState> => {
  const existing = await rowFor(manager, change)

  if (existing) return existing

  return manager.create(BlockState, {
    id: domain.asId<domain.BlockStateId>(change.docId),
    enrollmentId: prepared.access.enrollment.id,
    lessonVersionId: prepared.access.version.id,
    blockId: domain.asId<domain.BlockId>(String(change.data?.blockId)),
    schoolId: prepared.access.enrollment.schoolId,
  })
}

const validate = (
  data: domain.SyncPayload | null,
  exists: boolean,
): domain.SyncPayload | Rejection => {
  if (!data || !isBlockState(data.state)) {
    return reject('malformed', 'state is not a known block state')
  }

  if (!exists && !isUuid(data.blockId)) {
    return reject('malformed', 'a new block state must name its block')
  }

  return ownedBy('block_states', data)
}
