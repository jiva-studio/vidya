import type { LessonContent } from '@vidya/domain'
import { emptyLessonContent } from '@vidya/domain'
import { computed, ref, shallowRef } from 'vue'

/** How far back an author may walk. Deeper costs memory for steps nobody takes. */
const HistoryLimit = 50

/**
 * The document being edited, its history, and whether it differs from what the
 * server holds.
 *
 * Every state the document passes through is stamped with a revision number,
 * and dirtiness is a comparison of two numbers. Comparing serialisations
 * instead would run over the whole document on every reactive read — several
 * times per keystroke once autosave is watching.
 *
 * `markSaved` is handed the snapshot that was sent rather than reading what is
 * on screen, because the author keeps typing while the request is in flight:
 * clearing the flag against the current document would call those characters
 * saved and lose them on the next reload.
 *
 * The document is held in a `shallowRef` and replaced whole by every edit, so
 * the objects the history keeps are the ones that were on screen, not proxies
 * that would no longer match the snapshot a caller reports as sent.
 */
export const useLessonContentEditor = () => {
  const content = shallowRef<LessonContent>(emptyLessonContent())
  const revision = ref(0)
  const savedRevision = ref(0)
  const past = shallowRef<LessonContent[]>([])
  const future = shallowRef<LessonContent[]>([])

  const revisions = new WeakMap<LessonContent, number>()
  revisions.set(content.value, revision.value)

  const dirty = computed(() => revision.value !== savedRevision.value)
  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  /** Takes a document from the server as the new starting point. */
  const load = (next: LessonContent): void => {
    // A version's history may not reach into another's: an undo across the two
    // would write one version's text into the other.
    past.value = []
    future.value = []
    show(next)
    savedRevision.value = revision.value
  }

  const set = (next: LessonContent): void => {
    past.value = [...past.value, content.value].slice(-HistoryLimit)
    future.value = []
    show(next)
  }

  /** Clears the dirty flag only if the snapshot that reached the server is still current. */
  const markSaved = (sent: LessonContent): void => {
    const at = revisions.get(sent)
    if (at !== undefined) savedRevision.value = at
  }

  const undo = (): void => {
    const previous = past.value.at(-1)
    if (!previous) return

    past.value = past.value.slice(0, -1)
    future.value = [content.value, ...future.value]
    show(previous)
  }

  const redo = (): void => {
    const next = future.value.at(0)
    if (!next) return

    future.value = future.value.slice(1)
    past.value = [...past.value, content.value]
    show(next)
  }

  function show(next: LessonContent): void {
    revision.value += 1
    revisions.set(next, revision.value)
    content.value = next
  }

  return { content, revision, dirty, canUndo, canRedo, load, set, markSaved, undo, redo }
}
