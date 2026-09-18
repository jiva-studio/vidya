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
import CoursesPage from '../ui/CoursesPage.vue'

addMessages(messages)

// The bundles are asserted in English: the tests say what a reader of this
// repository can read, and the Russian half is checked by having the same keys.
locale.value = 'en'

const SCHOOL = asId<SchoolId>('11111111-1111-1111-1111-111111111111')
const COURSES = '/edu/courses'

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

const router = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/courses', name: 'courses', component: blank },
      { path: '/courses/new', name: 'course-create', component: blank },
      { path: '/courses/:courseId/edit', name: 'course-edit', component: blank },
      { path: '/courses/:courseId/lessons', name: 'lessons', component: blank },
    ],
  })

const open = (answers: Record<string, unknown>) => {
  const transport = fakeHttpClient(answers)
  const page = mountWithApp(CoursesPage, {
    global: { plugins: [router()], provide: { [httpClientKey as symbol]: transport.client } },
  })
  return { transport, page }
}

describe('CoursesPage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    signIn(['*'])
  })

  it('asks for the courses of the current school', async () => {
    const { transport } = open({ [COURSES]: { items: [] } })
    await flushPromises()

    expect(transport.calls[0]).toMatchObject({ path: COURSES, query: { schoolId: SCHOOL } })
  })

  it('shows the list once it arrives', async () => {
    const { page } = open({
      [COURSES]: { items: [{ id: 'c1', name: 'Sanskrit grammar', description: 'Cases' }] },
    })
    await flushPromises()

    expect(page.text()).toContain('Sanskrit grammar')
  })

  it('shows a loading state while the list is on its way', async () => {
    const { page } = open({ [COURSES]: pending() })
    await flushPromises()

    expect(page.findComponent(Skeleton).exists()).toBe(true)
  })

  it('says what to do next when the school teaches nothing yet', async () => {
    const { page } = open({ [COURSES]: { items: [] } })
    await flushPromises()

    expect(page.text()).toContain('No courses yet')
    expect(page.text()).toContain('Create a course')
  })

  it('shows the reason the server gave, and offers another go', async () => {
    const { transport, page } = open({ [COURSES]: refusal(500, 'The database is asleep') })
    await flushPromises()

    expect(page.text()).toContain('The database is asleep')

    const retry = page.findAll('button').find((button) => button.text() === 'Try again')
    await retry?.trigger('click')
    await flushPromises()

    expect(transport.callsTo(COURSES)).toHaveLength(2)
  })

  it('hides the create action from someone who may not create', async () => {
    useSession().end()
    signIn(['courses:read'])

    const { page } = open({ [COURSES]: { items: [] } })
    await flushPromises()

    expect(page.text()).not.toContain('New course')
    expect(page.text()).not.toContain('Create a course')
  })
})
