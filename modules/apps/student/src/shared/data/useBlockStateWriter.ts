import type { IBlockStateRepository, SaveBlockState } from '@vidya/client'
import { createGlobalState } from '@vueuse/core'
import { computed, ref } from 'vue'

import { useSyncRuns } from '@/shared/sync'

/**
 * The one write a lesson screen performs: the student's progress on a block.
 *
 * Narrowed to `save`, and offered by the tab that holds the writing lock. The
 * repository behind it is the journaled one the engine built, because a write
 * that skipped the journal would sit on this machine forever; a reading tab
 * adopts nothing, and its screens show what is recorded without offering to
 * record more.
 */
export type BlockStateWriter = Pick<IBlockStateRepository, 'save'>

export const useBlockStateWriter = createGlobalState(() => {
  const writer = ref<BlockStateWriter | undefined>(undefined)

  return {
    /** Whether this tab can record anything at all. */
    writable: computed(() => writer.value !== undefined),

    /** Offered by the writing tab while its engine lives, withdrawn when it stops. */
    adoptWriter: (writing: BlockStateWriter | undefined): void => {
      writer.value = writing
    },

    /**
     * Records the state, then asks for a run.
     *
     * The run is asked for after the write and only if it succeeded: a refused
     * write journaled nothing, and a run over no row is a request made for
     * nothing. Answering a quiz is the one write whose answer comes back down,
     * so waiting for the next reload would be waiting for the verdict.
     */
    save: async (input: SaveBlockState): Promise<boolean> => {
      const writing = writer.value
      if (writing === undefined) return false

      await writing.save(input)
      useSyncRuns().requestRun()

      return true
    },
  }
})
