import type { BlockId, LessonBlock } from '@vidya/domain'

/**
 * Where the caret goes when a block is deleted.
 *
 * Reading order decides: the block that took the deleted one's place, or the one
 * above when it was last. Nothing is returned for the only block in a section —
 * there is no block left to hold the caret, so the section title takes it.
 */
export const focusAfterRemoval = (
  blocks: readonly LessonBlock[],
  removedId: BlockId,
): BlockId | undefined => {
  const at = blocks.findIndex((block) => block.id === removedId)
  if (at < 0) return undefined

  return blocks[at + 1]?.id ?? blocks[at - 1]?.id
}
