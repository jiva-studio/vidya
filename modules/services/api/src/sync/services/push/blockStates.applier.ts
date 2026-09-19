import * as domain from '@vidya/domain'
import { BlockState } from '@vidya/entities'
import { PushChange } from '@vidya/protocol'
import { EntityManager } from 'typeorm'

import { isUuid, refsFrom, resolveAccess } from './access'
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
 * How far a student got through one block.
 *
 * The collection replicates upward only: the server writes nothing here, so
 * there is no field split to apply and no merge to reason about. The only
 * questions are whether the row belongs to the caller and whether its body is a
 * block state at all.
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

  // Progress is never frozen: a student may rewatch a video after the homework
  // on that lesson has been marked.
  async editable(): Promise<Rejection | null> {
    return null
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

    // The row the natural key held, when that is not the one the device named.
    return entity.id
  },
}

/** The row this document names, or the one the natural key already holds. */
const locate = async (
  manager: EntityManager,
  change: PushChange,
  prepared: PreparedRow,
): Promise<BlockState> => {
  const byId = await find(manager, change)

  if (byId) return byId

  const blockId = domain.asId<domain.BlockId>(String(change.data?.blockId))
  const natural = await manager.findOneBy(BlockState, {
    enrollmentId: prepared.access.enrollment.id,
    lessonVersionId: prepared.access.version.id,
    blockId,
  })

  if (natural) return natural

  return manager.create(BlockState, {
    id: domain.asId<domain.BlockStateId>(change.docId),
    enrollmentId: prepared.access.enrollment.id,
    lessonVersionId: prepared.access.version.id,
    blockId,
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
