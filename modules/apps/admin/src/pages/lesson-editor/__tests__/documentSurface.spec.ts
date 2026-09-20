import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { addMessages, locale } from '@/shared/i18n'

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

const MenuLabel = 'Block options'

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
      expect.arrayContaining(['Text', 'Image', 'Video', 'Audio', 'Quiz', 'Section']),
    )
  })

  // The line the menu was called from is empty, so it is the line that becomes
  // the chosen kind: a second block would leave that empty line behind.
  it('turns the line it was called from into the chosen kind', async () => {
    const { wrapper } = await openInsert()

    await clickOverlay('Image')

    expect(orderOf(wrapper)).toEqual(['b1', 'b2'])
    expect(block(wrapper, 'b2').textContent).toContain('Add an image')
  })

  it('leaves the caret in what it just added', async () => {
    const { wrapper } = await openInsert()

    await clickOverlay('Quiz')

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

    expect(overlayControl('Move up')?.hasAttribute('disabled')).toBe(true)
    expect(overlayControl('Move down')?.hasAttribute('disabled')).toBe(false)
  })

  it('cannot move the last block any lower', async () => {
    await openMenu('b2')

    expect(overlayControl('Move down')?.hasAttribute('disabled')).toBe(true)
  })

  it('moves the block past its neighbour', async () => {
    const { wrapper } = await openMenu('b1')

    await clickOverlay('Move down')

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

    expect(overlayControl('Move down')).toBeDefined()
  })

  it('leaves the caret in the block that follows a deleted one', async () => {
    const { wrapper } = await openMenu('b1')

    await clickOverlay('Delete')

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
      expect.arrayContaining(['Text', 'Image', 'Video', 'Audio', 'Quiz']),
    )
  })

  it('closes on escape and adds nothing', async () => {
    const { wrapper, field } = await slash()

    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()

    expect(overlayControl('Image')).toBeUndefined()
    expect(orderOf(wrapper)).toEqual(['b1', 'b2'])
  })
})

describe('a version nobody can change', () => {
  it('shows the document with no way to edit it', async () => {
    const { wrapper } = await open('published')

    await hover(wrapper, 'b1')

    expect(controlsOn(wrapper, 'b1')).toEqual([])
    const fields = wrapper.element.querySelectorAll(
      '[data-block-id] textarea, [data-block-id] input, [data-block-id] [contenteditable]',
    )
    expect(fields).toHaveLength(0)
    expect(wrapper.text()).toContain('First words')
  })
})
