import type { PermissionKey } from '@vidya/domain'
import { EmptyState } from '@vidya/ui'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, mountWithApp, pending, refusal } from '@/shared/testing'

import { messages } from '../i18n'
import HomeworkQueueFilters from '../ui/HomeworkQueueFilters.vue'
import HomeworkQueuePage from '../ui/HomeworkQueuePage.vue'

const HOMEWORK = '/edu/homework'
const blank = { template: '<div />' }

const signIn = (permissions: PermissionKey[]) => {
  const claims = {
    sub: 'u9',
    exp: 2_000_000_000,
    permissions: [{ sid: 'school-1', p: permissions }],
  }
  useSession().start({ accessToken: `h.${btoa(JSON.stringify(claims))}.s`, refreshToken: 'r' })
}

const summary = (id: string, enrollmentId: string) => ({
  id,
  enrollmentId,
  sectionId: 's1',
  status: 'pending',
  submittedAt: '2026-09-10T08:00:00.000Z',
})

const enrollment = (id: string, studentId: string) => ({
  id,
  courseId: 'c1',
  studentId,
  schoolId: 'school-1',
  status: 'accepted',
  groupId: 'g1',
  createdAt: '2026-09-01T10:00:00.000Z',
})

const world = (over: FakeAnswers = {}): FakeAnswers => ({
  '/edu/courses': { items: [{ id: 'c1', name: 'Foundations' }] },
  '/edu/groups': { items: [{ id: 'g1', name: 'Morning' }] },
  [HOMEWORK]: { items: [summary('h1', 'e1'), summary('h2', 'e2')] },
  '/edu/enrollments/e1': enrollment('e1', 'u1'),
  '/edu/enrollments/e2': enrollment('e2', 'u1'),
  '/edu/users/u1': { id: 'u1', name: 'Ann Ivanova', email: 'a@example.com', roles: [] },
  ...over,
})

const mountPage = async (answers: FakeAnswers, settle = true) => {
  const transport = fakeHttpClient(answers)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/homework', name: 'homework-queue', component: blank },
      { path: '/homework/:id', name: 'homework-review', component: blank },
    ],
  })
  await router.push('/homework')
  await router.isReady()

  const page = mountWithApp(HomeworkQueuePage, {
    global: { plugins: [router], provide: { [httpClientKey as symbol]: transport.client } },
  })

  if (settle) await flushPromises()
  return { transport, router, page }
}

const reads = (transport: { calls: { method: string; path: string }[] }) =>
  transport.calls.filter((call) => call.method === 'GET' && call.path === HOMEWORK)

describe('HomeworkQueuePage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    addMessages(messages)
    signIn(['homework:read', 'enrollments:read', 'users:read'] as PermissionKey[])
  })

  it('asks for the work that is waiting and names the students once each', async () => {
    const { transport, page } = await mountPage(world())

    expect(transport.calls[0]).toMatchObject({ path: HOMEWORK, query: { status: 'pending' } })
    expect(page.text()).toContain('Ann Ivanova')
    expect(page.text()).toContain('Foundations')
    expect(transport.callsTo('/edu/users/u1')).toHaveLength(1)
  })

  it('shows that it is loading while the list is on its way', async () => {
    const { page } = await mountPage(world({ [HOMEWORK]: pending() }), false)

    expect(page.find('[role="status"]').exists()).toBe(true)
  })

  it('says what to do next when nothing is waiting', async () => {
    const { page } = await mountPage(world({ [HOMEWORK]: { items: [] } }))

    expect(page.findComponent(EmptyState).exists()).toBe(true)
    expect(page.findAll('tbody tr')).toHaveLength(0)
  })

  it('shows our own words for a refusal, and reads the list again on demand', async () => {
    const { transport, page } = await mountPage(
      world({ [HOMEWORK]: refusal(503, 'The queue is unavailable') }),
    )

    const alert = page.find('[role="alert"]')
    expect(alert.text()).not.toContain('The queue is unavailable')
    expect(alert.text().length).toBeGreaterThan(0)

    await alert.find('button').trigger('click')
    await flushPromises()

    expect(reads(transport)).toHaveLength(2)
  })

  it('opens the work a row stands for', async () => {
    const { router, page } = await mountPage(world())

    await page.findAll('tbody tr')[0].trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('homework-review')
    expect(router.currentRoute.value.params.id).toBe('h1')
  })

  it('narrows the request by status, and the rows by course and group', async () => {
    const { transport, page } = await mountPage(world())
    const filters = page.findComponent(HomeworkQueueFilters)

    filters.vm.$emit('update:filters', { status: 'accepted' })
    await flushPromises()

    expect(reads(transport)[1]).toMatchObject({ query: { status: 'accepted' } })

    filters.vm.$emit('update:filters', { status: 'accepted', groupId: 'g-other' })
    await flushPromises()

    expect(reads(transport)).toHaveLength(2)
    expect(page.findAll('tbody tr')).toHaveLength(0)
  })
})
