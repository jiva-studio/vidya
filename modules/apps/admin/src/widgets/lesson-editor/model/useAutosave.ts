import type { LessonContent } from '@vidya/domain'
import { ref } from 'vue'

import type { Clock, Scheduled } from '@/shared/lib'
import { systemClock } from '@/shared/lib'

/** What the toolbar says about the document's journey to the server. */
export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'failed'

export interface AutosaveOptions {
  clock?: Clock
  delayMs?: number
}

/** Long enough to cover a pause for thought, short enough to survive a crash. */
const DefaultDelayMs = 1500

/**
 * Saving the document behind the author, without ever sending two at once.
 *
 * An edit replaces the pending save rather than queueing one, so a long
 * sentence costs a single request carrying its last word. A response that a
 * newer edit has already overtaken is dropped: reporting its failure would
 * fault a document that is no longer on screen, and reporting its success
 * would call the newest characters saved.
 *
 * `flush` is what the save shortcut calls and what publishing awaits — it
 * answers whether the document actually reached the server, so a publish can
 * stop rather than freeze a text the server never got.
 */
export const useAutosave = (
  save: (content: LessonContent) => Promise<boolean>,
  options: AutosaveOptions = {},
) => {
  const clock = options.clock ?? systemClock
  const delayMs = options.delayMs ?? DefaultDelayMs

  const status = ref<AutosaveStatus>('idle')

  let pending: LessonContent | undefined
  let lastSent: LessonContent | undefined
  let timer: Scheduled | undefined
  let running: Promise<void> | undefined
  let edits = 0

  /** Replaces whatever was waiting, so only the newest state is ever sent. */
  const schedule = (content: LessonContent): void => {
    edits += 1
    pending = content
    timer?.cancel()
    timer = clock.schedule(() => {
      timer = undefined
      void run()
    }, delayMs)
  }

  /** Sends what is waiting now and answers whether the server took it. */
  const flush = async (): Promise<boolean> => {
    timer?.cancel()
    timer = undefined

    // Nothing waiting is not the same as everything landed: a refused document
    // sits in `lastSent` and reaches the server only when `retry` offers it.
    if (pending === undefined && running === undefined) return status.value !== 'failed'

    await run()
    return status.value !== 'failed'
  }

  /** Offers the refused document again, unchanged. */
  const retry = async (): Promise<boolean> => {
    if (pending === undefined && lastSent !== undefined) pending = lastSent
    return flush()
  }

  function run(): Promise<void> {
    if (!running) {
      running = drive().finally(() => {
        running = undefined
      })
    }
    return running
  }

  async function drive(): Promise<void> {
    while (pending !== undefined) {
      const sending = pending
      const at = edits
      pending = undefined
      lastSent = sending
      status.value = 'saving'

      const ok = await save(sending)
      const current = at === edits

      if (current) status.value = ok ? 'saved' : 'failed'
      // A refusal of something the author has already moved past is not worth
      // stopping for; the newer state is what has to get through.
      if (!ok && current) return
    }
  }

  return { status, schedule, flush, retry }
}
