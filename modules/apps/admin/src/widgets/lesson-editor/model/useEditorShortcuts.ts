import { onBeforeUnmount, onMounted } from 'vue'

export interface EditorShortcutHandlers {
  undo: () => void
  redo: () => void
  save: () => void
}

/** The class CodeMirror puts on the element wrapping one of its editors. */
const TextEditorSelector = '.cm-editor'

const insideTextEditor = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(TextEditorSelector) !== null

/**
 * The shortcuts that act on the whole document.
 *
 * Undo stands down while the caret is inside a text editor: that editor keeps
 * its own history of characters, and two stacks answering one shortcut undo
 * unrelated amounts of work depending on where the focus happened to be.
 */
export const useEditorShortcuts = (handlers: EditorShortcutHandlers): void => {
  const onKeydown = (event: KeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return

    const key = event.key.toLowerCase()

    if (key === 's') {
      event.preventDefault()
      handlers.save()
      return
    }

    if (key !== 'z' || insideTextEditor(event.target)) return

    event.preventDefault()
    if (event.shiftKey) handlers.redo()
    else handlers.undo()
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
