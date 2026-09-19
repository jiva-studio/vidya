import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { addMessages, locale } from '@/shared/i18n'
import { refusal } from '@/shared/testing'

import { messages } from '../i18n'
import { contentOf, draftOf, sectionOf, textBlock } from './documents'
import { clickText, openEditor, plain, VERSIONS } from './harness'

addMessages(messages)
locale.value = 'en'

const Revised = 'The alphabet, revised'

const lesson = () => contentOf(sectionOf('s1', 'The alphabet', [textBlock('b1', 'First words')]))

/**
 * A draft whose every save is refused, with a publish endpoint standing ready.
 *
 * The version is rebuilt on every read, as a server hands back a fresh body each
 * time. A fixture answering with one object would return the identical reference
 * to the watcher that reloads the document, and hide the reload entirely.
 */
const refusingDraft = () => ({
  ...draftOf(lesson()),
  [`GET ${VERSIONS}/v1`]: () => ({
    id: 'v1',
    lessonId: 'l1',
    version: 1,
    status: 'draft',
    content: lesson(),
  }),
  [`PATCH ${VERSIONS}/v1`]: refusal(500, 'The draft could not be saved.'),
  [`POST ${VERSIONS}/v1/publish`]: { id: 'v1', lessonId: 'l1', version: 1, status: 'published' },
})

const titleField = (wrapper: { element: Element }): HTMLInputElement => {
  const input = wrapper.element.querySelector<HTMLInputElement>('input[aria-label="Section title"]')
  if (!input) throw new Error('no section title on screen')
  return input
}

const rename = async (wrapper: { element: Element }, title: string) => {
  const input = titleField(wrapper)
  input.value = title
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}

/** The dialog's own confirm, which shares its label with the toolbar's button. */
const confirmPublish = async () => {
  const dialog = document.body.querySelector('[role="alertdialog"]')
  const confirm = [...(dialog?.querySelectorAll('button') ?? [])].find(
    (node) => plain(node.textContent ?? '').trim() === 'Publish',
  )
  if (!confirm) throw new Error('the publish dialog is not open')

  confirm.click()
  await flushPromises()
}

/** Edits the lesson, watches the save be refused, and asks to publish anyway. */
const refusedThenPublished = async () => {
  const opened = await openEditor(refusingDraft())

  await rename(opened.wrapper, Revised)
  await clickText(opened.wrapper, 'Save draft')
  await clickText(opened.wrapper, 'Publish')
  await confirmPublish()

  return opened
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('publishing a version the server never received', () => {
  it('reports the refusal to the author', async () => {
    const { wrapper } = await openEditor(refusingDraft())

    await rename(wrapper, Revised)
    await clickText(wrapper, 'Save draft')

    expect(plain(wrapper.text())).toContain('Not saved')
  })

  it('does not freeze a version while the last edit is still unsaved', async () => {
    const { http } = await refusedThenPublished()

    expect(http.calls.filter((call) => call.path.endsWith('/publish'))).toHaveLength(0)
  })

  it('does not throw away the refused edit when it reopens the version', async () => {
    const { wrapper } = await refusedThenPublished()

    expect(titleField(wrapper).value).toBe(Revised)
  })
})
