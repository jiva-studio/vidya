import type { BlockStateId, EnrollmentId, HomeworkId } from '@vidya/domain'
import { asId } from '@vidya/domain'

/**
 * Ids for rows the device creates before any server has seen them.
 *
 * The device names its own rows so that a retry after a crash writes the same
 * document rather than a second one, and so that the row can be journaled and
 * read back while there is no connection to ask for an id.
 */

export const newEnrollmentId = (): EnrollmentId => asId<EnrollmentId>(crypto.randomUUID())

export const newHomeworkId = (): HomeworkId => asId<HomeworkId>(crypto.randomUUID())

export const newBlockStateId = (): BlockStateId => asId<BlockStateId>(crypto.randomUUID())
