import type { LessonVersionId } from '@vidya/domain'
import { ref } from 'vue'

/**
 * Editing a published version starts the next one, without being asked.
 *
 * A published version is frozen because students have answered against it, but
 * that is a fact about the stored snapshot, not a mode the author should have
 * to leave. Every editor people know — Payload, Optimizely, Notion — opens the
 * live document editable and forks a draft on the first keystroke; a "new
 * version" button in front of that is a step whose only effect is to stop
 * someone typing.
 *
 * One fork however many keystrokes arrive while it is in flight: the second
 * request would be refused by the server, which allows a single open draft, and
 * the refusal would land as an error over a document that is fine.
 */
export const useDraftFork = (
  openRevision: () => Promise<LessonVersionId | undefined>,
  openVersion: (id: LessonVersionId) => Promise<void>,
) => {
  const forking = ref(false)

  let running: Promise<boolean> | undefined

  const fork = async (): Promise<boolean> => {
    const created = await openRevision()
    if (!created) return false

    await openVersion(created)
    return true
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
