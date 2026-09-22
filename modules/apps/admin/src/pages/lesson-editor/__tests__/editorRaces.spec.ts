import type { LessonContent } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { addMessages, locale, translate } from '@/shared/i18n'

import { messages } from '../i18n'
import { contentOf, sectionOf, textBlock } from './documents'
import { LESSON_PATH, openEditor, plain, saveDraft, saveSays, VERSIONS } from './harness'

addMessages(messages)
locale.value = 'en'

/** A promise the test settles by hand, to hold a request in flight. */
const deferred = <T>() => {
  let settle!: (value: T) => void
  const promise = new Promise<T>((resolve) => {
    settle = resolve
  })

  return { promise, settle }
}

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

const lessonAnswers = {
  [`GET ${LESSON_PATH}`]: { id: 'l1', courseId: 'c1', lessonNumber: 1, title: 'The alphabet' },
}

/** A published v1 whose fork answers with v2. */
const published = (over: Record<string, unknown> = {}) => {
  let forked = false

  return {
    ...lessonAnswers,
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

/** An open draft v1, ready to take saves. */
const draft = (over: Record<string, unknown> = {}) => ({
  ...lessonAnswers,
  [`GET ${VERSIONS}`]: { items: [summary('v1', 1, 'draft')] },
  [`GET ${VERSIONS}/v1`]: details('v1', 1, 'draft'),
  [`PATCH ${VERSIONS}/v1`]: details('v1', 1, 'draft'),
  ...over,
})

const writes = (
  http: { calls: { method: string; path: string; body?: unknown }[] },
  path: string,
) => http.calls.filter((call) => call.path === path)

const saveButton = (wrapper: {
  findAll: (s: string) => { text: () => string; attributes: (n: string) => string | undefined }[]
}) => wrapper.findAll('button').find((node) => plain(node.text()) === translate('action-save'))

const titleSent = (body: unknown): string | undefined =>
  (body as { content: LessonContent }).content.sections[0]?.title

/** An edit that survives pruning, unlike an empty section. */
const rename = async (wrapper: { element: Element }, title: string) => {
  const input = wrapper.element.querySelector<HTMLInputElement>('input[aria-label="Section title"]')
  if (!input) throw new Error('no section title on screen')

  input.value = title
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}

describe('the editor under rapid edits and answers that arrive late', () => {
  beforeEach(() => {
    locale.value = 'en'
  })

  it('starts one revision however many edits arrive while it is in flight', async () => {
    const post = deferred<unknown>()

    const { wrapper, http } = await openEditor(
      published({ [`POST ${VERSIONS}`]: () => post.promise }),
    )

    for (let edit = 0; edit < 5; edit += 1) await rename(wrapper, `Letter ${edit}`)

    expect(writes(http, VERSIONS).filter((call) => call.method === 'POST')).toHaveLength(1)

    post.settle(summary('v2', 2, 'draft'))
    await flushPromises()

    expect(writes(http, VERSIONS).filter((call) => call.method === 'POST')).toHaveLength(1)
  })

  it('saves the newest document when the revision answers after further edits', async () => {
    const post = deferred<unknown>()

    const { wrapper, http } = await openEditor(
      published({ [`POST ${VERSIONS}`]: () => post.promise }),
    )

    await rename(wrapper, 'First pass')
    await rename(wrapper, 'Second pass')
    await rename(wrapper, 'Third pass')

    post.settle(summary('v2', 2, 'draft'))
    await flushPromises()

    await saveDraft()

    const patches = writes(http, `${VERSIONS}/v2`).filter((call) => call.method === 'PATCH')
    expect(patches.length).toBeGreaterThan(0)
    expect(titleSent(patches.at(-1)?.body)).toBe('Third pass')
  })

  it('does not call a document saved while a later edit is still on its way', async () => {
    const answers = [deferred<unknown>(), deferred<unknown>()]
    let sent = 0

    const { wrapper, http } = await openEditor(
      draft({
        [`PATCH ${VERSIONS}/v1`]: () => {
          sent += 1
          return answers[sent - 1]?.promise ?? details('v1', 1, 'draft')
        },
      }),
    )

    await rename(wrapper, 'First pass')
    await saveDraft()

    await rename(wrapper, 'Second pass')

    answers[0]?.settle(details('v1', 1, 'draft'))
    await flushPromises()

    expect(sent).toBe(2)
    expect(saveSays(wrapper)).not.toBe(translate('toast-saved'))
    expect(saveButton(wrapper)?.attributes('disabled')).toBeUndefined()

    answers[1]?.settle(details('v1', 1, 'draft'))
    await flushPromises()

    const patches = writes(http, `${VERSIONS}/v1`).filter((call) => call.method === 'PATCH')
    expect(titleSent(patches.at(-1)?.body)).toBe('Second pass')
    expect(saveSays(wrapper)).toBe(translate('toast-saved'))
  })

  it('leaves nothing behind when the editor is closed with a revision in flight', async () => {
    const post = deferred<unknown>()
    const complaints = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const rejections: unknown[] = []
    const onRejection = (event: PromiseRejectionEvent) => rejections.push(event.reason)

    window.addEventListener('unhandledrejection', onRejection)

    try {
      const { wrapper } = await openEditor(published({ [`POST ${VERSIONS}`]: () => post.promise }))

      await rename(wrapper, 'Closed mid-fork')
      wrapper.unmount()

      post.settle(summary('v2', 2, 'draft'))
      await flushPromises()
      await flushPromises()

      expect(complaints).not.toHaveBeenCalled()
      expect(warnings).not.toHaveBeenCalled()
      expect(rejections).toEqual([])
    } finally {
      window.removeEventListener('unhandledrejection', onRejection)
      complaints.mockRestore()
      warnings.mockRestore()
    }
  })

  it('leaves nothing behind when the editor is closed with a save in flight', async () => {
    const patch = deferred<unknown>()
    const complaints = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const rejections: unknown[] = []
    const onRejection = (event: PromiseRejectionEvent) => rejections.push(event.reason)

    window.addEventListener('unhandledrejection', onRejection)

    try {
      const { wrapper } = await openEditor(draft({ [`PATCH ${VERSIONS}/v1`]: () => patch.promise }))

      await rename(wrapper, 'Closed mid-save')
      await saveDraft()
      wrapper.unmount()

      patch.settle(details('v1', 1, 'draft'))
      await flushPromises()
      await flushPromises()

      expect(complaints).not.toHaveBeenCalled()
      expect(warnings).not.toHaveBeenCalled()
      expect(rejections).toEqual([])
    } finally {
      window.removeEventListener('unhandledrejection', onRejection)
      complaints.mockRestore()
      warnings.mockRestore()
    }
  })
})
