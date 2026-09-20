import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { mountWithApp } from '@/shared/testing'

import { useEditorShortcuts } from '../model'

const handlers = () => ({ undo: vi.fn(), redo: vi.fn(), save: vi.fn() })

/** The editor's shortcuts, listening on a window, over a document to aim at. */
const listening = (on: ReturnType<typeof handlers>) => {
  const Host = defineComponent({
    name: 'ShortcutHost',
    setup() {
      useEditorShortcuts(on)
      return () =>
        h('div', [
          h('div', { class: 'cm-editor' }, [h('div', { class: 'cm-line', tabindex: '0' })]),
          h('input', { class: 'plain' }),
        ])
    },
  })

  const wrapper = mountWithApp(Host, { attachTo: document.body })

  const press = (key: string, target: Element | Window, modifiers: Partial<KeyboardEvent> = {}) => {
    const event = new KeyboardEvent('keydown', {
      key,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
      ...modifiers,
    })

    target.dispatchEvent(event)
    return event
  }

  const inside = () => wrapper.element.querySelector('.cm-line') as Element
  const outside = () => wrapper.element.querySelector('.plain') as Element

  return { wrapper, press, inside, outside }
}

describe('the shortcut that undoes the document', () => {
  it('acts when the caret is not in a text block', () => {
    const on = handlers()
    const keyboard = listening(on)

    keyboard.press('z', keyboard.outside())

    expect(on.undo).toHaveBeenCalledTimes(1)
    keyboard.wrapper.unmount()
  })

  it('stands down while the caret is inside a text block', () => {
    const on = handlers()
    const keyboard = listening(on)

    const event = keyboard.press('z', keyboard.inside())

    expect(on.undo).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
    keyboard.wrapper.unmount()
  })

  it('stands down for the redo shortcut in there too', () => {
    const on = handlers()
    const keyboard = listening(on)

    keyboard.press('z', keyboard.inside(), { shiftKey: true })

    expect(on.redo).not.toHaveBeenCalled()
    keyboard.wrapper.unmount()
  })

  it('redoes outside a text block', () => {
    const on = handlers()
    const keyboard = listening(on)

    keyboard.press('z', keyboard.outside(), { shiftKey: true })

    expect(on.redo).toHaveBeenCalledTimes(1)
    expect(on.undo).not.toHaveBeenCalled()
    keyboard.wrapper.unmount()
  })

  it('ignores the same key with another modifier held', () => {
    const on = handlers()
    const keyboard = listening(on)

    keyboard.press('z', keyboard.outside(), { altKey: true })
    keyboard.press('z', keyboard.outside(), { ctrlKey: false })

    expect(on.undo).not.toHaveBeenCalled()
    keyboard.wrapper.unmount()
  })
})

describe('the shortcut that saves', () => {
  it('saves from inside a text block as readily as from outside one', () => {
    const on = handlers()
    const keyboard = listening(on)

    keyboard.press('s', keyboard.inside())
    keyboard.press('s', keyboard.outside())

    expect(on.save).toHaveBeenCalledTimes(2)
    keyboard.wrapper.unmount()
  })

  it('keeps the browser from opening its own save dialog', () => {
    const on = handlers()
    const keyboard = listening(on)

    expect(keyboard.press('s', keyboard.outside()).defaultPrevented).toBe(true)
    keyboard.wrapper.unmount()
  })
})

describe('when the editor is gone', () => {
  it('answers no shortcut once it has been unmounted', () => {
    const on = handlers()
    const keyboard = listening(on)

    keyboard.wrapper.unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))

    expect(on.undo).not.toHaveBeenCalled()
  })
})
