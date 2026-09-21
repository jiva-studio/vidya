import { createGlobalState } from '@vueuse/core'
import { ref } from 'vue'

/** A sync run, as the tab that owns the engine offers it. */
export type SyncRun = () => void

/**
 * How a screen asks for data it has just made itself eligible for.
 *
 * Joining a school changes what the server will send, and the engine is woken
 * otherwise only at start-up and when the network comes back — without this
 * the student would sit in front of an empty catalogue until they reloaded the
 * page. The run is offered by the tab that holds the writing lock; a reading
 * tab has no engine to offer, so its request is answered by the writing tab's
 * next run rather than by this one.
 */
export const useSyncRuns = createGlobalState(() => {
  const runner = ref<SyncRun | undefined>(undefined)

  return {
    /** Offered by the writing tab while its engine lives, withdrawn when it stops. */
    adoptRunner: (run: SyncRun | undefined): void => {
      runner.value = run
    },

    /** Answers whether there was an engine in this tab to ask. */
    requestRun: (): boolean => {
      const run = runner.value
      if (run === undefined) return false

      run()
      return true
    },
  }
})
