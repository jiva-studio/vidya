import type { LessonContent } from '@vidya/domain'
import { beforeEach, describe, expect, it } from 'vitest'

import { addMessages, locale } from '@/shared/i18n'

import { messages } from '../i18n'
import { contentOf, draftOf, sectionOf, textBlock } from './documents'
import { clickOverlay, openEditor, openInsertMenu, saveDraft, VERSIONS } from './harness'

addMessages(messages)
locale.value = 'en'

const lesson = () => contentOf(sectionOf('s1', 'The alphabet', [textBlock('b1', 'First words')]))

const blocksOn = (wrapper: { element: Element }) => [
  ...wrapper.element.querySelectorAll('[data-block-id]'),
]

/** Adds a block of `kind` below the one the author is in, and types nothing into it. */
const insertBlank = async (wrapper: { element: Element }, kind: string) => {
  await openInsertMenu(wrapper.element)
  await clickOverlay(kind)
}

const savedContent = (http: { calls: { method: string; body?: unknown }[] }): LessonContent =>
  (http.calls.find((call) => call.method === 'PATCH')?.body as { content: LessonContent }).content

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('a blank block the save drops', () => {
  it('is not sent to the server', async () => {
    const { wrapper, http } = await openEditor(draftOf(lesson()))

    await insertBlank(wrapper, 'Image')
    await saveDraft()

    expect(savedContent(http).sections[0].blocks).toHaveLength(1)
  })

  it('stays on screen, because the caret is standing in it', async () => {
    const { wrapper } = await openEditor(draftOf(lesson()))

    await insertBlank(wrapper, 'Image')
    await saveDraft()

    expect(blocksOn(wrapper)).toHaveLength(2)
  })

  it('leaves the document the server answered with out of the editor', async () => {
    const { wrapper } = await openEditor({
      ...draftOf(lesson()),
      // A server that answered with something else entirely would replace the
      // document on screen if the response were ever written back.
      [`PATCH ${VERSIONS}/v1`]: {
        id: 'v1',
        lessonId: 'l1',
        version: 1,
        status: 'draft',
        content: contentOf(sectionOf('s9', 'Something else', [textBlock('b9', 'Not yours')])),
      },
    })

    await insertBlank(wrapper, 'Image')
    await saveDraft()

    expect(blocksOn(wrapper).map((node) => node.getAttribute('data-block-id'))[0]).toBe('b1')
    expect(wrapper.element.textContent).not.toContain('Not yours')
  })
})
