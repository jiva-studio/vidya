import type { LocalBlockState } from '@vidya/client'
import type { BlockId, LessonBlockState } from '@vidya/domain'

/** What the student has done, keyed by the block it was done on. */
export const toBlockStates = (
  states: readonly LocalBlockState[],
): Partial<Record<BlockId, LessonBlockState>> =>
  Object.fromEntries(states.map((state) => [state.blockId, state.state as LessonBlockState]))
