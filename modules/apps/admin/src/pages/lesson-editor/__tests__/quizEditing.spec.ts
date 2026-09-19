import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { addMessages, locale } from '@/shared/i18n'

import { messages } from '../i18n'
import { contentOf, draftOf, quizBlock, sectionOf } from './documents'
import { accessibleName, openEditor } from './harness'

addMessages(messages)
locale.value = 'en'

const lesson = (answers?: string[]) =>
  contentOf(sectionOf('s1', 'The alphabet', [quizBlock('q1', answers)]))

const open = (answers?: string[]) => openEditor(draftOf(lesson(answers)))

const options = (wrapper: { element: Element }): HTMLInputElement[] =>
  [
    ...wrapper.element.querySelectorAll<HTMLInputElement>(
      '[data-block-id="q1"] input[type="text"]',
    ),
  ].filter((node) => accessibleName(node).startsWith('Answer'))

const press = async (field: Element, key: string) => {
  field.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  await flushPromises()
}

const type = async (field: HTMLInputElement, value: string) => {
  field.value = value
  field.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('adding an option from the keyboard', () => {
  it('appends one when the author is in the last option', async () => {
    const { wrapper } = await open()

    await press(options(wrapper)[1], 'Enter')

    expect(options(wrapper)).toHaveLength(3)
    expect(options(wrapper)[2].value).toBe('')
  })

  it('leaves the caret in the option it just added', async () => {
    const { wrapper } = await open()

    await press(options(wrapper)[1], 'Enter')

    expect(document.activeElement).toBe(options(wrapper)[2])
  })

  it('inserts directly below the option the author was in', async () => {
    const { wrapper } = await open(['Krishna', 'Arjuna', 'Sanjaya'])

    await press(options(wrapper)[0], 'Enter')

    expect(options(wrapper).map((field) => field.value)).toEqual([
      'Krishna',
      '',
      'Arjuna',
      'Sanjaya',
    ])
  })
})

describe('removing an option from the keyboard', () => {
  it('removes an option the author emptied', async () => {
    const { wrapper } = await open(['Krishna', 'Arjuna', ''])

    await press(options(wrapper)[2], 'Backspace')

    expect(options(wrapper).map((field) => field.value)).toEqual(['Krishna', 'Arjuna'])
  })

  it('puts the caret at the end of the option above', async () => {
    const { wrapper } = await open(['Krishna', 'Arjuna', ''])

    await press(options(wrapper)[2], 'Backspace')

    const previous = options(wrapper)[1]
    expect(document.activeElement).toBe(previous)
    expect(previous.selectionStart).toBe(previous.value.length)
  })

  it('leaves an option alone while anything is written in it', async () => {
    const { wrapper } = await open()

    await press(options(wrapper)[1], 'Backspace')

    expect(options(wrapper)).toHaveLength(2)
  })

  it('never takes away the last option a quiz has', async () => {
    const { wrapper } = await open(['', ''])

    await press(options(wrapper)[1], 'Backspace')
    await press(options(wrapper)[0], 'Backspace')

    expect(options(wrapper).length).toBeGreaterThanOrEqual(1)
  })
})

describe('what a quiz row carries', () => {
  it('offers the correct-answer control, the text and a way to remove the row', async () => {
    const { wrapper } = await open()
    const rows = wrapper.element.querySelectorAll('[data-block-id="q1"] [data-answer-index]')

    expect(rows).toHaveLength(2)

    const first = rows[0]
    expect(first.querySelector('input[type="radio"], [role="radio"]')).not.toBeNull()
    expect(first.querySelector('input[type="text"]')).not.toBeNull()
    expect(
      [...first.querySelectorAll('button')].some((node) => accessibleName(node).includes('Remove')),
    ).toBe(true)
  })

  it('keeps the same option correct after the author typed into another', async () => {
    const { wrapper } = await open()

    await type(options(wrapper)[1], 'Arjuna and nobody else')

    const marks = [
      ...wrapper.element.querySelectorAll('[data-block-id="q1"] input[type="radio"]'),
    ] as HTMLInputElement[]
    expect(marks[0].checked).toBe(true)
  })
})

describe('the explanation', () => {
  it('offers a place to say why the answer is the answer', async () => {
    const { wrapper } = await open()
    const fields = [
      ...wrapper.element.querySelectorAll(
        '[data-block-id="q1"] textarea, [data-block-id="q1"] input',
      ),
    ]

    expect(fields.some((node) => accessibleName(node) === 'Explanation')).toBe(true)
  })
})
