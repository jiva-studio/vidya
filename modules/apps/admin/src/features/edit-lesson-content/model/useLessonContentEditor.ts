import type { LessonContent } from '@vidya/domain'
import { emptyLessonContent } from '@vidya/domain'
import { computed, ref } from 'vue'

const snapshot = (content: LessonContent): string => JSON.stringify(content)

/**
 * The document being edited, and whether it differs from what the server holds.
 *
 * Dirtiness is a comparison with the last saved snapshot rather than a flag
 * raised by each command: a flag has to be lowered in every path that saves,
 * reloads or discards, and the one path that forgets is the one that loses an
 * author's work behind a silent "no changes".
 */
export const useLessonContentEditor = () => {
  const content = ref<LessonContent>(emptyLessonContent())
  const saved = ref(snapshot(content.value))

  const dirty = computed(() => snapshot(content.value) !== saved.value)

  /** Takes a document from the server as the new starting point. */
  const load = (next: LessonContent): void => {
    content.value = next
    saved.value = snapshot(next)
  }

  const set = (next: LessonContent): void => {
    content.value = next
  }

  const markSaved = (): void => {
    saved.value = snapshot(content.value)
  }

  return { content, dirty, load, set, markSaved }
}
