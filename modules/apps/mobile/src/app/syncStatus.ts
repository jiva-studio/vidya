import type { SyncRunResult } from '@vidya/usecases'
import { createGlobalState } from '@vueuse/core'
import { computed, type Ref, ref } from 'vue'

/**
 * What the sync engine has told the screens so far.
 *
 * Counted across every connection rather than per server: a student sees one
 * app, and "still filling up" is true while any of their schools is still
 * arriving.
 *
 * `total` stays at `0` because the protocol never says how much a backfill will
 * bring — a pull answers with a page and whether there is more. The progress
 * component reads `0` as "still counting" and shows an indeterminate bar, which
 * is the honest picture.
 */
export interface SyncStatus {
  /** A run is going on right now. Its fall to `false` is "a run just finished". */
  readonly syncing: Readonly<Ref<boolean>>

  /** A run has completed at least once, so an empty screen means empty. */
  readonly firstRunCompleted: Readonly<Ref<boolean>>

  /** Rows already applied to the device. */
  readonly done: Readonly<Ref<number>>

  /** Rows the first run expects; `0` while that is unknown. */
  readonly total: Readonly<Ref<number>>

  runStarted(): void
  runFinished(result: SyncRunResult): void

  /**
   * Says the device is already filled, without a run having finished here.
   *
   * A launch that finds scope positions on the device is a launch after a
   * first run that happened some other day: the courses are already there, and
   * the screens must not cover them with "getting your courses ready" — least
   * of all with no network, which is exactly when that promise cannot be kept.
   */
  markFilled(): void
}

export const useSyncStatus = createGlobalState((): SyncStatus => {
  const inFlight = ref(0)
  const firstRunCompleted = ref(false)
  const done = ref(0)
  const total = ref(0)

  const runStarted = () => {
    inFlight.value += 1
  }

  const runFinished = (result: SyncRunResult) => {
    inFlight.value = Math.max(0, inFlight.value - 1)
    done.value += result.pull?.applied ?? 0
    if (result.outcome === 'completed') firstRunCompleted.value = true
  }

  const markFilled = () => {
    firstRunCompleted.value = true
  }

  return {
    syncing: computed(() => inFlight.value > 0),
    firstRunCompleted,
    done,
    total,
    runStarted,
    runFinished,
    markFilled,
  }
})
