import type { LessonContent } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages, locale, translate } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import { fakeHttpClient, mountWithApp, refusal, signInAs, STORY_SCHOOL } from '@/shared/testing'

import { messages } from '../i18n'
import { routes } from '../routes'
import LessonVersionPage from '../ui/LessonVersionPage.vue'

addMessages(messages)
locale.value = 'en'

const VERSION = '/edu/lessons/l1/versions/v7'
const PATH = `/s/${STORY_SCHOOL}/lessons/l1/versions/v7`

const content = (): LessonContent =>
  ({
    schemaVersion: 1,
    sections: [
      {
        id: 's1',
        title: 'The alphabet',
        assessment: 'none',
        blocks: [
          { id: 'b1', type: 'text', content: '# Letters and sounds\n\nRead **left to right**' },
        ],
      },
    ],
  }) as unknown as LessonContent

const open = async (answers: Record<string, unknown>) => {
  resetApi()
  signInAs(['lessons:read'])

  const router = createRouter({
    history: createMemoryHistory(),
    // The section's own records, so the test proves the address the homework
    // notice links against rather than one invented here.
    routes: routes.map((route) => ({
      path: route.path,
      name: route.name,
      component: LessonVersionPage,
    })),
  })

  await router.push(PATH)
  await router.isReady()

  const transport = fakeHttpClient(answers)
  const page = mountWithApp(LessonVersionPage, {
    global: { plugins: [router], provide: { [httpClientKey as symbol]: transport.client } },
  })
  await flushPromises()

  return { page, transport }
}

/** The rendered markdown, below the page's own heading. */
const heading = (page: { element: Element }): HTMLElement | undefined =>
  [...page.element.querySelectorAll<HTMLElement>('h1')].at(-1)

describe('LessonVersionPage', () => {
  beforeEach(() => {
    localStorage.clear()
    useSession().end()
  })

  it('shows the version the address names, not the newest one', async () => {
    const { page, transport } = await open({
      [VERSION]: { id: 'v7', lessonId: 'l1', version: 1, status: 'published', content: content() },
    })

    expect(page.text()).toContain('The alphabet')
    expect(page.text()).toContain('Read')
    expect(transport.callsTo(VERSION)).toHaveLength(1)
  })

  it('offers nothing to edit: the screen is a reading of a frozen version', async () => {
    const { page } = await open({
      [VERSION]: { id: 'v7', lessonId: 'l1', version: 1, status: 'published', content: content() },
    })

    expect(page.findAll('textarea')).toHaveLength(0)
    expect(page.findAll('input')).toHaveLength(0)
  })

  it('renders the markdown a reader sees, through the sanitising chain', async () => {
    const { page } = await open({
      [VERSION]: { id: 'v7', lessonId: 'l1', version: 1, status: 'published', content: content() },
    })

    expect(page.html()).toContain('<strong>left to right</strong>')
    expect(heading(page)?.textContent).toBe('Letters and sounds')
  })

  // jsdom computes no styles, so the rule itself is the evidence: the container
  // sets one size for its own text and a larger one for a heading.
  it('sizes a heading apart from the text around it', async () => {
    const { page } = await open({
      [VERSION]: { id: 'v7', lessonId: 'l1', version: 1, status: 'published', content: content() },
    })

    const container = heading(page)?.parentElement

    expect(container?.className).toMatch(/text-\[length:var\(--text-base\)\]/)
    expect(container?.className).toMatch(/\[&_h1\]:text-\[length:var\(--text-lg\)\]/)
  })

  it('offers another go when the version could not be read', async () => {
    const { page } = await open({ [VERSION]: refusal(503, 'Lesson storage is unavailable') })

    expect(page.text()).not.toContain('Lesson storage is unavailable')
    expect(page.text()).toContain(translate('state-error'))
    expect(page.text()).toContain(translate('action-retry'))
  })
})
