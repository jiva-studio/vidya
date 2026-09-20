import type { BlockStateId, EnrollmentId, HomeworkId } from '@vidya/domain'
import { asId } from '@vidya/domain'

import type { UuidSource } from '@/ports'

/**
 * Ids for rows the device creates before any server has seen them.
 *
 * The device names its own rows so that a retry after a crash writes the same
 * document rather than a second one, and so that the row can be journaled and
 * read back while there is no connection to ask for an id.
 *
 * The source is installed by the composition root rather than reached for
 * here: this layer is pure, and a test that cannot fix the sequence cannot say
 * what a write produced.
 */

let uuids: UuidSource | null = null

/** Installs the source. The composition root does it once, before the first screen. */
export const useUuidSource = (source: UuidSource): void => {
  uuids = source
}

const newUuid = (): string => {
  if (uuids === null) throw new Error('no uuid source is installed')
  return uuids()
}

export const newEnrollmentId = (): EnrollmentId => asId<EnrollmentId>(newUuid())

export const newHomeworkId = (): HomeworkId => asId<HomeworkId>(newUuid())

export const newBlockStateId = (): BlockStateId => asId<BlockStateId>(newUuid())
