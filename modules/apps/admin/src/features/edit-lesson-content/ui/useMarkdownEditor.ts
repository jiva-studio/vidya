import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { onBeforeUnmount, ref, watch } from 'vue'

import type { MarkdownEditor, MarkdownEditorOptions } from './types'

/**
 * A markdown source surface, owned for exactly as long as the block is on screen.
 *
 * The extension set is assembled by hand rather than taken from `basicSetup`:
 * the block's gutter is the only chrome a block is allowed, so an editor that
 * brought its own line numbers, fold markers or search panel would put controls
 * inside a frame that promises two.
 */
export const useMarkdownEditor = (options: MarkdownEditorOptions): MarkdownEditor => {
  const view = ref<EditorView | undefined>(undefined)
  const focused = ref(false)

  const extensions = [
    markdown(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    history(),
    EditorView.lineWrapping,
    // The surface is reached by Tab and by the caret handoff from a deleted
    // block, and an editable region without a tab stop answers to neither.
    EditorView.contentAttributes.of({ tabindex: '0' }),
    keymap.of([
      // The author is offered the menu but still types the character: closing
      // the menu has to leave the line exactly as they typed it.
      { key: '/', run: onSlash },
      { key: 'Escape', run: onEscape },
      ...historyKeymap,
      ...defaultKeymap,
    ]),
    EditorView.updateListener.of((update) => {
      if (update.focusChanged) focused.value = update.view.hasFocus
      if (update.docChanged) options.onChange(update.state.doc.toString())
    }),
  ]

  function onSlash(): boolean {
    if (!isBlankStart()) return false
    options.onSlash()
    return false
  }

  function onEscape(): boolean {
    options.onEscape()
    return false
  }

  /** The menu is a way to start a block, so it is offered only on an empty line. */
  function isBlankStart(): boolean {
    const state = view.value?.state
    if (!state) return false
    return state.doc.length === 0 && state.selection.main.head === 0
  }

  function mount(host: HTMLElement) {
    view.value = new EditorView({
      state: EditorState.create({ doc: options.doc.value, extensions }),
      parent: host,
    })
  }

  watch(
    options.host,
    (host) => {
      if (host && !view.value) mount(host)
    },
    { immediate: true, flush: 'post' },
  )

  // An edit that came from somewhere else — an undo, a version swap — has to
  // reach the surface, while the author's own keystrokes must not be echoed
  // back at them mid-word.
  watch(options.doc, (next) => {
    const current = view.value
    if (!current || current.state.doc.toString() === next) return

    current.dispatch({ changes: { from: 0, to: current.state.doc.length, insert: next } })
  })

  onBeforeUnmount(() => {
    view.value?.destroy()
    view.value = undefined
  })

  return {
    focused,
    focus: () => view.value?.focus(),
  }
}
