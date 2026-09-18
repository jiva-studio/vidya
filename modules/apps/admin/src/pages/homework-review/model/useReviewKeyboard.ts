import { onBeforeUnmount, onMounted } from 'vue'

/** What each key does. The screen decides what the words mean. */
export interface ReviewKeyHandlers {
  accept: () => void
  returnWork: () => void
  next: () => void
}

const EDITABLE = ['INPUT', 'TEXTAREA', 'SELECT']

/**
 * The keys that make the review screen a workplace rather than a form.
 *
 * `j` moves on as it did when the list and the work shared a screen, and `n`
 * does the same for anyone who reads the tooltip rather than remembering it.
 *
 * Typing a mark must not decide anything, so a key pressed inside a field is
 * left to the field, and a key held with a modifier belongs to the browser.
 */
export const useReviewKeyboard = (handlers: ReviewKeyHandlers): void => {
  const actions: Record<string, () => void> = {
    a: handlers.accept,
    r: handlers.returnWork,
    j: handlers.next,
    n: handlers.next,
  }

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey || event.altKey) return

    const target = event.target as HTMLElement | null
    if (target && (EDITABLE.includes(target.tagName) || target.isContentEditable)) return

    const action = actions[event.key]
    if (!action) return

    event.preventDefault()
    action()
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
