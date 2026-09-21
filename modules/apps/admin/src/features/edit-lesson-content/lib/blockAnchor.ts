import type { BlockId } from '@vidya/domain'

/** Where a notice about an unfinished block points. One anchor per block. */
export const blockAnchorOf = (id: BlockId): string => `lesson-block-${id}`
