import { beforeEach, describe, expect, it, vi } from 'vitest'

import { addMessages, locale } from '@/shared/i18n'

import { messages } from '../i18n'
import { contentOf, draftOf, quizBlock, sectionOf, textBlock } from './documents'
import { accessibleName, clickText, labels, openEditor, plain } from './harness'

addMessages(messages)
locale.value = 'en'

/**
 * A lesson whose second block is a quiz with a question and one usable answer.
 *
 * Started but unanswerable, which is exactly what publishing refuses and what
 * an author cannot find on a long page from a sentence counting sections.
 */
const unfinished = () =>
  contentOf(
    sectionOf('s1', 'The alphabet', [
      textBlock('b1', 'First words'),
      quizBlock('b2', ['Krishna', ''], 'Who speaks?'),
    ]),
  )

const frameOf = (wrapper: { element: Element }, blockId: string) =>
  wrapper.element.querySelector(`[data-block-id="${blockId}"]`)

describe('what stops a publish', () => {
  beforeEach(() => {
    // jsdom has no layout, so the editor's scroll into view has nothing to do.
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('marks the block that is unfinished, not only the section it sits in', async () => {
    const { wrapper } = await openEditor(draftOf(unfinished()))

    await clickText(wrapper, 'Publish')

    expect(frameOf(wrapper, 'b2')?.getAttribute('aria-invalid')).toBe('true')
    expect(frameOf(wrapper, 'b1')?.getAttribute('aria-invalid')).toBeNull()
  })

  it('takes the reader to the block when the notice naming it is pressed', async () => {
    const { wrapper } = await openEditor(draftOf(unfinished()))

    await clickText(wrapper, 'Publish')

    const line = [...wrapper.element.querySelectorAll('button')].find((node) =>
      accessibleName(node).startsWith('Section 1, block 2'),
    )
    expect(line).toBeDefined()

    line?.click()

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('does not open the publish dialog while a block is unfinished', async () => {
    const { wrapper } = await openEditor(draftOf(unfinished()))

    await clickText(wrapper, 'Publish')

    expect(document.body.textContent).not.toContain('Publish this version?')
  })

  it('marks nothing while the author is still writing', async () => {
    const { wrapper } = await openEditor(draftOf(unfinished()))

    expect(frameOf(wrapper, 'b2')?.getAttribute('aria-invalid')).toBeNull()
    expect(plain(wrapper.text())).not.toContain('Section 1, block 2')
  })
})

describe('the save button', () => {
  const settled = () => contentOf(sectionOf('s1', 'The alphabet', [textBlock('b1', 'First words')]))

  it('is offered, and says there is nothing to send until something changes', async () => {
    const { wrapper } = await openEditor(draftOf(settled()))

    const save = wrapper.findAll('button').find((node) => plain(node.text()) === 'Save')

    expect(labels(wrapper)).toContain('Save')
    expect(save?.attributes('disabled')).toBeDefined()
  })
})
