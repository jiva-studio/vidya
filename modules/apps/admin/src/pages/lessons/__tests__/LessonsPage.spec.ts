import type { SchoolId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { Skeleton } from '@vidya/ui'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages, locale } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import { fakeHttpClient, mountWithApp, pending, refusal } from '@/shared/testing'

import { messages } from '../i18n'
import LessonsPage from '../ui/LessonsPage.vue'

addMessages(messages)
locale.value = 'en'

const SCHOOL = asId<SchoolId>('11111111-1111-1111-1111-111111111111')
const COURSE = '22222222-2222-2222-2222-222222222222'
const LESSONS = '/edu/lessons'

const blank = { template: '<div />' }

const token = (permissions: unknown) =>
  `header.${btoa(JSON.stringify({ sub: 'u1', exp: 2_000_000_000, permissions }))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')}.sig`

const signIn = (granted: string[]) =>
  useSession().start({
    accessToken: token([{ sid: SCHOOL, p: granted }]),
    refreshToken: 'refresh',
  })

// Fluent wraps every placeable in bidi isolation marks, which are invisible on
// screen and in the way of a string comparison.
const plain = (text: string) => text.replaceAll('\u2068', '').replaceAll('\u2069', '')

const lesson = (id: string, number: number, title: string) => ({
  id,
  lessonNumber: number,
  title,
})

const versions = (lessonId: string, entries: [number, string][]) => ({
  items: entries.map(([version, status]) => ({
    id: `${lessonId}-${version}`,
    lessonId,
    version,
    status,
  })),
})

const open = async (answers: Record<string, unknown>) => {
  const routes = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/courses', name: 'courses', component: blank },
      { path: '/courses/:courseId/lessons', name: 'lessons', component: blank },
      { path: '/courses/:courseId/lessons/:lessonId', name: 'lesson-editor', component: blank },
    ],
  })

  await routes.push(`/courses/${COURSE}/lessons`)
  await routes.isReady()

  const transport = fakeHttpClient(answers)
  const page = mountWithApp(LessonsPage, {
    global: { plugins: [routes], provide: { [httpClientKey as symbol]: transport.client } },
  })
  await flushPromises()

  return { transport, page }
}

describe('LessonsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    signIn(['*'])
  })

  it('asks for the lessons of the course in the address', async () => {
    const { transport } = await open({ [LESSONS]: { items: [] } })

    expect(transport.calls[0]).toMatchObject({ path: LESSONS, query: { courseId: COURSE } })
  })

  it('shows the number, the title and the state of the latest version', async () => {
    const { page } = await open({
      [`${LESSONS}/l1/versions`]: versions('l1', [[1, 'draft']]),
      [`${LESSONS}/l2/versions`]: versions('l2', [[1, 'published']]),
      [`${LESSONS}/l3/versions`]: versions('l3', [
        [1, 'published'],
        [2, 'draft'],
      ]),
      [LESSONS]: {
        items: [lesson('l1', 1, 'Alphabet'), lesson('l2', 2, 'Sandhi'), lesson('l3', 3, 'Cases')],
      },
    })

    const rows = page.findAll('tbody tr').map((row) => plain(row.text()))

    expect(rows[0]).toContain('1')
    expect(rows[0]).toContain('Alphabet')
    expect(rows[0]).toContain('Draft v1')
    expect(rows[1]).toContain('Published v1')
    expect(rows[2]).toContain('Published v1 · draft v2')
  })

  it('shows a loading state while the lessons are on their way', async () => {
    const { page } = await open({ [LESSONS]: pending() })

    expect(page.findComponent(Skeleton).exists()).toBe(true)
  })

  it('says what to do next when the course has no lessons', async () => {
    const { page } = await open({ [LESSONS]: { items: [] } })

    expect(page.text()).toContain('This course has no lessons')
    expect(page.text()).toContain('Add the first lesson')
  })

  it('shows the reason the server gave, and offers another go', async () => {
    const { transport, page } = await open({ [LESSONS]: refusal(500, 'The database is asleep') })

    expect(page.text()).toContain('The database is asleep')

    const retry = page.findAll('button').find((button) => button.text() === 'Try again')
    await retry?.trigger('click')
    await flushPromises()

    expect(transport.callsTo(LESSONS)).toHaveLength(2)
  })

  it('hides editing from someone who may not edit a lesson', async () => {
    useSession().end()
    signIn(['lessons:read'])

    const { page } = await open({
      [`${LESSONS}/l1/versions`]: versions('l1', [[1, 'draft']]),
      [LESSONS]: { items: [lesson('l1', 1, 'Alphabet')] },
    })

    expect(page.text()).not.toContain('Edit')
    expect(page.text()).not.toContain('Add lesson')
  })
})
