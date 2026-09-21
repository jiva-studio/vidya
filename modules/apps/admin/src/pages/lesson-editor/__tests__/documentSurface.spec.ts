import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { addMessages, locale, translate } from '@/shared/i18n'

import { messages } from '../i18n'
import { contentOf, draftOf, sectionOf, textBlock } from './documents'
import {
  accessibleName,
  clickOverlay,
  openEditor,
  openInsertMenu,
  overlayControl,
  overlayControls,
} from './harness'

addMessages(messages)
locale.value = 'en'

const MenuLabel = translate('editor-block-menu')

const lesson = () =>
  contentOf(sectionOf('s1', 'The alphabet', [textBlock('b1', 'First words'), textBlock('b2', '')]))

const open = (status: 'draft' | 'published' = 'draft') => openEditor(draftOf(lesson(), status))

const block = (wrapper: { element: Element }, id: string): HTMLElement => {
  const node = wrapper.element.querySelector<HTMLElement>(`[data-block-id="${id}"]`)
  if (!node) throw new Error(`no block ${id} on screen`)
  return node
}

const controlsOn = (wrapper: { element: Element }, id: string) =>
  [...block(wrapper, id).querySelectorAll('button')].map(accessibleName)

const orderOf = (wrapper: { element: Element }) =>
  [...wrapper.element.querySelectorAll('[data-block-id]')].map((node) =>
    node.getAttribute('data-block-id'),
  )

const hover = async (wrapper: { element: Element }, id: string) => {
  block(wrapper, id).dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
  await flushPromises()
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('the controls a block offers', () => {
  it('shows a block no chrome until the pointer reaches it', async () => {
    const { wrapper } = await open()

    expect(controlsOn(wrapper, 'b1')).toEqual([])
  })

  it('offers exactly one control when the pointer reaches it', async () => {
    const { wrapper } = await open()

    await hover(wrapper, 'b1')

    expect(controlsOn(wrapper, 'b1')).toEqual([MenuLabel])
  })

  it('offers the same one when the keyboard walks into it instead', async () => {
    const { wrapper } = await open()

    block(wrapper, 'b1').dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await flushPromises()

    expect(controlsOn(wrapper, 'b1')).toEqual([MenuLabel])
  })

  it('leaves the other blocks bare while one is hovered', async () => {
    const { wrapper } = await open()

    await hover(wrapper, 'b1')

    expect(controlsOn(wrapper, 'b2')).toEqual([])
  })
})

describe('adding a block', () => {
  const openInsert = async () => {
    const opened = await open()
    await openInsertMenu(opened.wrapper.element)
    return opened
  }

  it('offers every kind this build can author, and a section', async () => {
    await openInsert()

    const offered = overlayControls().map(accessibleName)

    expect(offered).toEqual(
      expect.arrayContaining([
        translate('editor-block-text'),
        translate('editor-block-image'),
        translate('editor-block-video'),
        translate('editor-block-audio'),
        translate('editor-block-quiz'),
        translate('editor-block-section'),
      ]),
    )
  })

  // The line the menu was called from is empty, so it is the line that becomes
  // the chosen kind: a second block would leave that empty line behind.
  it('turns the line it was called from into the chosen kind', async () => {
    const { wrapper } = await openInsert()

    await clickOverlay(translate('editor-block-image'))

    expect(orderOf(wrapper)).toEqual(['b1', 'b2'])
    expect(block(wrapper, 'b2').textContent).toContain('Add an image')
  })

  it('leaves the caret in what it just added', async () => {
    const { wrapper } = await openInsert()

    await clickOverlay(translate('editor-block-quiz'))

    expect(block(wrapper, 'b2').contains(document.activeElement)).toBe(true)
  })
})

describe('the menu on a block', () => {
  const openMenu = async (id: string) => {
    const opened = await open()
    await hover(opened.wrapper, id)
    const handle = [...block(opened.wrapper, id).querySelectorAll('button')].find(
      (node) => accessibleName(node) === MenuLabel,
    )
    handle?.click()
    await flushPromises()
    return opened
  }

  it('cannot move the first block any higher', async () => {
    await openMenu('b1')

    expect(overlayControl(translate('editor-move-up'))?.hasAttribute('disabled')).toBe(true)
    expect(overlayControl(translate('editor-move-down'))?.hasAttribute('disabled')).toBe(false)
  })

  it('cannot move the last block any lower', async () => {
    await openMenu('b2')

    expect(overlayControl(translate('editor-move-down'))?.hasAttribute('disabled')).toBe(true)
  })

  it('moves the block past its neighbour', async () => {
    const { wrapper } = await openMenu('b1')

    await clickOverlay(translate('editor-move-down'))

    expect(orderOf(wrapper)).toEqual(['b2', 'b1'])
  })

  it('opens from the keyboard, without a pointer ever touching the block', async () => {
    const { wrapper } = await open()

    block(wrapper, 'b1').dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await flushPromises()

    const handle = [...block(wrapper, 'b1').querySelectorAll('button')].find(
      (node) => accessibleName(node) === MenuLabel,
    )
    handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flushPromises()

    expect(overlayControl(translate('editor-move-down'))).toBeDefined()
  })

  it('leaves the caret in the block that follows a deleted one', async () => {
    const { wrapper } = await openMenu('b1')

    await clickOverlay(translate('action-delete'))

    expect(orderOf(wrapper)).toEqual(['b2'])
    expect(block(wrapper, 'b2').contains(document.activeElement)).toBe(true)
  })
})

describe('typing a slash in an empty block', () => {
  const slash = async () => {
    const opened = await open()
    const field = block(opened.wrapper, 'b2').querySelector<HTMLTextAreaElement>(
      'textarea, [contenteditable]',
    )
    if (!field) throw new Error('the empty block offers nowhere to type')

    field.focus()
    field.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }))
    await flushPromises()

    return { ...opened, field }
  }

  it('opens the same menu the insert button opens', async () => {
    await slash()

    expect(overlayControls().map(accessibleName)).toEqual(
      expect.arrayContaining([
        translate('editor-block-text'),
        translate('editor-block-image'),
        translate('editor-block-video'),
        translate('editor-block-audio'),
        translate('editor-block-quiz'),
      ]),
    )
  })

  it('closes on escape and adds nothing', async () => {
    const { wrapper, field } = await slash()

    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()

    expect(overlayControl(translate('editor-block-image'))).toBeUndefined()
    expect(orderOf(wrapper)).toEqual(['b1', 'b2'])
  })
})

describe('a version students already read', () => {
  // It is a frozen snapshot on the server, not a mode the author is put in:
  // the first edit forks the next draft, so the document opens writable.
  it('shows the document ready to be written in', async () => {
    const { wrapper } = await open('published')

    await hover(wrapper, 'b1')

    expect(controlsOn(wrapper, 'b1')).not.toEqual([])
    const fields = wrapper.element.querySelectorAll(
      '[data-block-id] textarea, [data-block-id] input, [data-block-id] [contenteditable]',
    )
    expect(fields.length).toBeGreaterThan(0)
    expect(wrapper.text()).toContain('First words')
  })
})

describe('the edges of the document', () => {
  const fieldsOf = (wrapper: { element: Element }) => [
    ...wrapper.element.querySelectorAll<HTMLElement>('.cm-content, textarea, input[type="text"]'),
  ]

  const arrow = async (node: HTMLElement, key: 'ArrowUp' | 'ArrowDown') => {
    node.focus()
    node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    await flushPromises()
  }

  it('keeps the caret where it is at the last field of the last section', async () => {
    const { wrapper } = await open()
    const last = fieldsOf(wrapper).at(-1) as HTMLElement

    await arrow(last, 'ArrowDown')

    expect(document.activeElement).toBe(last)
  })

  it('keeps the caret where it is at the first field of the first section', async () => {
    const { wrapper } = await open()
    const [first] = fieldsOf(wrapper)

    await arrow(first, 'ArrowUp')

    expect(document.activeElement).toBe(first)
  })
})

describe('a section with nothing in it', () => {
  const emptySection = () => contentOf(sectionOf('s1', 'The alphabet', []))

  it('offers the line to write the first block into', async () => {
    const { wrapper } = await openEditor(draftOf(emptySection(), 'draft'))
    const root = wrapper.element as Element

    const tail = [...root.querySelectorAll('button')].find((node) =>
      accessibleName(node).startsWith(translate('editor-text-label')),
    )

    expect(tail).toBeDefined()
  })

  it('opens exactly one block when that line is clicked', async () => {
    const { wrapper } = await openEditor(draftOf(emptySection(), 'draft'))
    const root = wrapper.element as Element

    await openInsertMenu(root)
    await clickOverlay(translate('editor-block-text'))

    expect(root.querySelectorAll('[data-block-frame]')).toHaveLength(1)
  })
})
