import { onBeforeUnmount, onMounted } from 'vue'

/** What each key does. The pane decides what the words mean. */
export interface QueueKeyHandlers {
  next: () => void
  previous: () => void
  accept: () => void
  returnWork: () => void
}

const EDITABLE = ['INPUT', 'TEXTAREA', 'SELECT']

/**
 * The four keys that make the queue a workplace rather than a list of links.
 *
 * `j` and `k` move, `a` accepts and `r` returns, exactly as they read in the
 * hint under the work. Typing a grade must not decide anything, so a key
 * pressed inside a field is left to the field, and a key held with a modifier
 * belongs to the browser.
 */
export const useQueueKeyboard = (handlers: QueueKeyHandlers): void => {
  const actions: Record<string, () => void> = {
    j: handlers.next,
    k: handlers.previous,
    a: handlers.accept,
    r: handlers.returnWork,
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
