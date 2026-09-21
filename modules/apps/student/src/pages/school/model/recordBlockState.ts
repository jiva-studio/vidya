import type { LocalBlockState, LocalLessonVersion, SaveBlockState } from '@vidya/client'
import type { BlockId, EnrollmentId, LessonBlockState } from '@vidya/domain'

export interface BlockStateRecord {
  readonly version: LocalLessonVersion

  /** The place the progress is recorded against; a block state belongs to one. */
  readonly enrollmentId: EnrollmentId

  /** What is already recorded on this version, so a second write finds its row. */
  readonly states: readonly LocalBlockState[]

  readonly blockId: BlockId
  readonly state: LessonBlockState
  readonly mintId: () => string
}

/**
 * What a screen hands the writer when the student has done something.
 *
 * One block holds one row: the id already written against it is kept, and a
 * new one is minted only where nothing is recorded yet. Writing a second row
 * would leave the block with two answers and let the progress count pass the
 * number of blocks there are.
 */
export const recordBlockState = (input: BlockStateRecord): SaveBlockState => {
  const recorded = input.states.find((state) => state.blockId === input.blockId)

  return {
    id: recorded?.id ?? input.mintId(),
    schoolId: input.version.schoolId,
    enrollmentId: input.enrollmentId,
    lessonVersionId: input.version.id,
    blockId: input.blockId,
    state: input.state,
  }
}
