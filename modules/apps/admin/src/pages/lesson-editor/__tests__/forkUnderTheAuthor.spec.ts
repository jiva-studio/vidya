import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { addMessages, locale } from '@/shared/i18n'
import { pending, refusal } from '@/shared/testing'

import { messages } from '../i18n'
import { contentOf, sectionOf, textBlock } from './documents'
import {
  addSection,
  LESSON_PATH,
  openEditor,
  plain,
  saveButton,
  saveDraft,
  VERSIONS,
} from './harness'

addMessages(messages)
locale.value = 'en'

const lesson = () => contentOf(sectionOf('s1', 'The alphabet', [textBlock('b1', 'First words')]))

const summary = (id: string, version: number, status: 'draft' | 'published') => ({
  id,
  lessonId: 'l1',
  version,
  status,
})

const details = (id: string, version: number, status: 'draft' | 'published') => ({
  ...summary(id, version, status),
  content: lesson(),
})

/** A published v1, with whatever the fork's two requests should answer. */
const published = (over: Record<string, unknown> = {}) => {
  let forked = false

  return {
    [`GET ${LESSON_PATH}`]: { id: 'l1', courseId: 'c1', lessonNumber: 1, title: 'The alphabet' },
    [`GET ${VERSIONS}`]: () => ({
      items: forked
        ? [summary('v1', 1, 'published'), summary('v2', 2, 'draft')]
        : [summary('v1', 1, 'published')],
    }),
    [`GET ${VERSIONS}/v1`]: details('v1', 1, 'published'),
    [`GET ${VERSIONS}/v2`]: details('v2', 2, 'draft'),
    [`POST ${VERSIONS}`]: () => {
      forked = true
      return summary('v2', 2, 'draft')
    },
    [`PATCH ${VERSIONS}/v2`]: details('v2', 2, 'draft'),
    ...over,
  }
}

const surfaces = (wrapper: { element: Element }) =>
  wrapper.element.querySelectorAll('.cm-content').length

describe('forking a published version under the author', () => {
  beforeEach(() => {
    locale.value = 'en'
  })

  // The fork reuses the same `open` the first page load uses. If it also
  // raises the page skeleton, the document unmounts for two round trips —
  // everything typed during them is lost, and the caret with it.
  it('leaves the document on screen while the new draft is being opened', async () => {
    const { wrapper } = await openEditor(published({ [`GET ${VERSIONS}/v2`]: pending() }))

    const before = surfaces(wrapper)
    expect(before).toBeGreaterThan(0)

    await addSection(wrapper)

    expect(surfaces(wrapper)).toBeGreaterThanOrEqual(before)
    expect(plain(wrapper.text())).toContain('First words')
  })

  it('keeps the edit on screen when the fork is refused', async () => {
    const { wrapper } = await openEditor(
      published({ [`POST ${VERSIONS}`]: refusal(500, 'No new versions today') }),
    )

    await addSection(wrapper)

    expect(plain(wrapper.text())).toContain('First words')
  })

  // The button read `dirty`, which a refused fork leaves true. It was enabled,
  // it issued nothing, and the word beside it still said the version was safe.
  it('offers the save again after a refused fork, and actually sends it', async () => {
    let refuse = true
    let forked = false

    const { wrapper, http } = await openEditor({
      ...published(),
      [`POST ${VERSIONS}`]: () => {
        if (refuse) throw refusal(500, 'No new versions today')
        forked = true
        return summary('v2', 2, 'draft')
      },
      [`GET ${VERSIONS}`]: () => ({
        items: forked
          ? [summary('v1', 1, 'published'), summary('v2', 2, 'draft')]
          : [summary('v1', 1, 'published')],
      }),
    })

    await addSection(wrapper)
    expect(saveButton(wrapper)?.disabled).toBe(false)

    refuse = false
    await saveDraft()
    await flushPromises()

    expect(http.calls.some((call) => call.method === 'PATCH')).toBe(true)
  })

  // The POST answered, the read after it did not. The version on screen is
  // still the frozen one, so the edit has nowhere to go and must not be
  // reported as saved.
  it('does not call the draft open when the read after the fork fails', async () => {
    const { wrapper, http } = await openEditor(
      published({ [`GET ${VERSIONS}/v2`]: refusal(500, 'Gone') }),
    )

    await addSection(wrapper)
    await flushPromises()

    expect(http.calls.filter((call) => call.method === 'PATCH')).toHaveLength(0)
  })
})
