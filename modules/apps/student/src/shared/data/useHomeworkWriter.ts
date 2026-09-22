import type { IHomeworkRepository, LocalHomework, SaveHomeworkAnswer } from '@vidya/client'
import { HomeworkFrozenError } from '@vidya/client'
import { type HomeworkId, type IsoDateTime, toIsoDateTime } from '@vidya/domain'
import { createGlobalState } from '@vueuse/core'
import { computed, ref } from 'vue'

import { useSyncRuns } from '@/shared/sync'

/**
 * The two writes a homework screen performs: the answer's text, and handing it in.
 *
 * Narrowed to those, and offered by the tab that holds the writing lock. The
 * repository behind it is the journaled one the engine built, because a write
 * that skipped the journal would sit on this machine forever; a reading tab
 * adopts nothing, and its screens show the answer without offering to change it.
 */
export type HomeworkWriter = Pick<IHomeworkRepository, 'saveAnswer' | 'submit'>

/**
 * What a write ended as.
 *
 * `frozen` is the library refusing to touch an answer that has left the device,
 * and it is not an error the screen reports as a fault: the rule is the same
 * one the screen draws by, so reaching it means the two have drifted and the
 * screen re-reads rather than tells the student off.
 */
export type HomeworkWriteOutcome = 'written' | 'frozen' | 'unwritable'

export const useHomeworkWriter = createGlobalState(() => {
  const writer = ref<HomeworkWriter | undefined>(undefined)
  let clock: () => IsoDateTime = () => toIsoDateTime(new Date())

  const write = async (
    perform: (writing: HomeworkWriter) => Promise<LocalHomework>,
  ): Promise<HomeworkWriteOutcome> => {
    const writing = writer.value
    if (writing === undefined) return 'unwritable'

    try {
      await perform(writing)
    } catch (error) {
      if (error instanceof HomeworkFrozenError) return 'frozen'
      throw error
    }

    useSyncRuns().requestRun()
    return 'written'
  }

  return {
    /** Whether this tab can write an answer at all. */
    writable: computed(() => writer.value !== undefined),

    /** Offered by the writing tab while its engine lives, withdrawn when it stops. */
    adoptWriter: (writing: HomeworkWriter | undefined): void => {
      writer.value = writing
    },

    /** Injected clock for deterministic timestamps. */
    adoptClock: (customClock: (() => IsoDateTime) | undefined): void => {
      clock = customClock ?? (() => toIsoDateTime(new Date()))
    },

    saveAnswer: (input: SaveHomeworkAnswer): Promise<HomeworkWriteOutcome> =>
      write((writing) => writing.saveAnswer(input)),

    submitAnswer: (id: HomeworkId, at?: IsoDateTime): Promise<HomeworkWriteOutcome> =>
      write((writing) => writing.submit(id, at ?? clock())),
  }
})
