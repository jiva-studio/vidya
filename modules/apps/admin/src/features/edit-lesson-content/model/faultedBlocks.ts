import type { BlockId } from '@vidya/domain'
import type { InjectionKey, Ref } from 'vue'
import { computed, inject, provide, ref } from 'vue'

const EMPTY = ref<readonly BlockId[]>([])

const faultedBlocksKey: InjectionKey<Ref<readonly BlockId[]>> = Symbol('faulted-blocks')

/**
 * Which blocks stopped the last publish, for the blocks themselves to read.
 *
 * Provided rather than passed down: the list is owned by whoever pressed
 * publish and read by a frame four levels below it, and threading a prop
 * through the document and every section to say "not you" to all of them is
 * three signatures for one fact.
 */
export const provideFaultedBlocks = (blocks: Ref<readonly BlockId[]>): void => {
  provide(faultedBlocksKey, blocks)
}

/** Whether this block is one of them. An editor outside a document has none. */
export const useIsFaulted = (blockId: () => BlockId) => {
  const faulted = inject(faultedBlocksKey, EMPTY)
  return computed(() => faulted.value.includes(blockId()))
}
