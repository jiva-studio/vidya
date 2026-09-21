import type { BlockId } from '@vidya/domain'
import type { InjectionKey, Ref } from 'vue'
import { computed, inject, provide, ref } from 'vue'

const EMPTY = ref<readonly BlockId[]>([])

const faultedBlocksKey: InjectionKey<Ref<readonly BlockId[]>> = Symbol('faulted-blocks')

/**
 * Which blocks stopped the last publish, for the blocks themselves to read.
 *
 * Provided rather than passed down: the owner is four levels above the reader,
 * and the prop would cross two components that have no use for it.
 */
export const provideFaultedBlocks = (blocks: Ref<readonly BlockId[]>): void => {
  provide(faultedBlocksKey, blocks)
}

/** An editor mounted outside a document has none. */
export const useIsFaulted = (blockId: () => BlockId) => {
  const faulted = inject(faultedBlocksKey, EMPTY)
  return computed(() => faulted.value.includes(blockId()))
}
