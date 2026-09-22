import type { LocalBlockState } from '@vidya/client'
import type { BlockId, QuizVerdict } from '@vidya/domain'

/**
 * What the school said about each answer, keyed by the block it was said on.
 *
 * Only marked answers appear: a verdict is written by the server and stays
 * null until it has one, and a block with an absent verdict must read as
 * unmarked rather than as marked wrong.
 */
export const toVerdicts = (
  states: readonly LocalBlockState[],
): Partial<Record<BlockId, QuizVerdict>> =>
  Object.fromEntries(
    states
      .filter((state) => state.verdict !== null)
      .map((state) => [state.blockId, state.verdict as QuizVerdict]),
  )
