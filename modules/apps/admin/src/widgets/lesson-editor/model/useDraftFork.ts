import type { LessonVersionId } from '@vidya/domain'
import { ref } from 'vue'

/**
 * Editing a published version starts the next one.
 *
 * The server allows a single open draft, so a second request while the first
 * is in flight is a refusal over a document that is fine: `start` hands every
 * caller the one promise until it settles.
 */
export const useDraftFork = (
  openRevision: () => Promise<LessonVersionId | undefined>,
  openVersion: (id: LessonVersionId) => Promise<boolean>,
) => {
  const forking = ref(false)

  let running: Promise<boolean> | undefined

  // Success is the draft being open, not the POST having answered: the read
  // after it can fail, leaving the frozen version on screen.
  const fork = async (): Promise<boolean> => {
    const created = await openRevision()
    if (!created) return false

    return openVersion(created)
  }

  /** Answers whether there is now a draft to save into. */
  const start = (): Promise<boolean> => {
    if (!running) {
      forking.value = true
      running = fork().finally(() => {
        running = undefined
        forking.value = false
      })
    }

    return running
  }

  return { forking, start }
}
