import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { onBeforeUnmount, ref, watch } from 'vue'

import type { MoveDirection } from '../types'
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
    EditorView.theme({
      '&': { outline: 'none' },
      '&.cm-focused': { outline: 'none' },
      '.cm-content': { padding: '0', fontFamily: 'inherit', fontSize: 'inherit' },
      '.cm-line': { padding: '0' },
      '.cm-scroller': { fontFamily: 'inherit', lineHeight: 'inherit' },
    }),
    // The surface is reached by Tab and by the caret handoff from a deleted
    // block, and an editable region without a tab stop answers to neither.
    EditorView.contentAttributes.of({ tabindex: '0' }),
    keymap.of([
      // On an empty line the slash is the command and not a character: it opens
      // the menu, the line stays empty — so picking a kind turns this block
      // into it — and the key is reported as handled, which is also what keeps
      // Firefox from taking it for Quick Find.
      { key: '/', run: onSlash },
      { key: 'Escape', run: onEscape },
      // Before the default binding, which would keep the caret on the edge line
      // it already sits on and report the key as handled.
      { key: 'ArrowUp', run: () => onExit(-1) },
      { key: 'ArrowDown', run: () => onExit(1) },
      // Enter breaks the line, as it does in any text. It ends the block only
      // when it is pressed on a blank line at the end of one — the way a writer
      // leaves a paragraph behind — and that blank line goes with it.
      { key: 'Enter', run: onEnd },
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
    return true
  }

  function onEnd(): boolean {
    const state = view.value?.state
    if (!state) return false

    const at = state.selection.main.head
    const line = state.doc.lineAt(at)
    const leaving = at === state.doc.length && line.text.length === 0 && state.doc.lines > 1
    if (!leaving) return false

    options.onEnd(state.doc.sliceString(0, Math.max(line.from - 1, 0)))
    return true
  }

  function onExit(delta: MoveDirection): boolean {
    const state = view.value?.state
    if (!state) return false

    const line = state.doc.lineAt(state.selection.main.head)
    const edge = delta < 0 ? line.number === 1 : line.number === state.doc.lines
    return edge ? options.onStep(delta) : false
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
