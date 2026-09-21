import type { PermissionKey } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setAppRouter } from '@/shared/access'
import { httpClientKey, resetApi } from '@/shared/api'
import { useSession } from '@/shared/session'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, mountWithApp, refusal } from '@/shared/testing'

import DashboardPage from '../ui/DashboardPage.vue'

const ENROLLMENTS = '/edu/enrollments'
const HOMEWORK = '/edu/homework'

const blank = { template: '<div />' }

const signIn = (permissions: PermissionKey[]) => {
  const claims = {
    sub: 'u1',
    exp: 2_000_000_000,
    permissions: [{ sid: 'school-1', p: permissions }],
  }
  useSession().start({ accessToken: `h.${btoa(JSON.stringify(claims))}.s`, refreshToken: 'r' })
}

const rows = (howMany: number) => ({
  items: Array.from({ length: howMany }, (_, index) => ({ id: `row-${index}` })),
})

const open = async (answers: FakeAnswers = {}) => {
  const transport = fakeHttpClient({
    [ENROLLMENTS]: rows(0),
    [HOMEWORK]: rows(0),
    ...answers,
  })

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/s/:schoolId', name: 'dashboard', component: blank },
      { path: '/s/:schoolId/enrollments', name: 'enrollments', component: blank },
      { path: '/s/:schoolId/homework', name: 'homework-queue', component: blank },
      { path: '/s/:schoolId/courses', name: 'courses', component: blank },
      { path: '/s/:schoolId/groups', name: 'groups', component: blank },
      { path: '/s/:schoolId/users', name: 'users', component: blank },
    ],
  })
  setAppRouter(router)
  await router.push('/s/school-1')
  await router.isReady()

  const page = mountWithApp(DashboardPage, {
    global: { plugins: [router], provide: { [httpClientKey as symbol]: transport.client } },
  })

  await flushPromises()
  return { transport, page, router }
}

const cards = (page: Awaited<ReturnType<typeof open>>['page']) => page.findAll('button')

const click = async (page: Awaited<ReturnType<typeof open>>['page'], text: string) => {
  const card = cards(page).find((node) => node.text().includes(text))
  expect(card, `no card offering ${text}`).toBeDefined()
  await card?.trigger('click')
  await flushPromises()
}

describe('DashboardPage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
  })

  it('says a role is missing rather than showing an empty page', async () => {
    signIn([])

    const { page } = await open()

    expect(page.text()).toContain('В этой школе вам пока ничего не разрешено')
  })

  it('counts what is waiting in each queue the role may read', async () => {
    signIn(['enrollments:read', 'homework:read'])

    const { page } = await open({ [ENROLLMENTS]: rows(4), [HOMEWORK]: rows(7) })

    expect(page.text()).toContain('Заявки ждут решения')
    expect(page.text()).toContain('4')
    expect(page.text()).toContain('Домашние работы на проверке')
    expect(page.text()).toContain('7')
  })

  it('asks each queue only for what is waiting', async () => {
    signIn(['enrollments:read', 'homework:read'])

    const { transport } = await open()

    expect(transport.calls.find((call) => call.path === ENROLLMENTS)?.query).toMatchObject({
      status: 'pending',
    })
    expect(transport.calls.find((call) => call.path === HOMEWORK)?.query).toMatchObject({
      status: 'pending',
    })
  })

  it('offers no island for a section the role cannot reach', async () => {
    signIn(['homework:read'])

    const { page } = await open({ [HOMEWORK]: rows(2) })

    expect(page.text()).toContain('Домашние работы на проверке')
    expect(page.text()).not.toContain('Заявки ждут решения')
    expect(page.text()).not.toContain('Курсы и уроки')
  })

  it('takes the reader to the section the island names', async () => {
    signIn(['enrollments:read'])

    const { page, router } = await open({ [ENROLLMENTS]: rows(1) })
    await click(page, 'Разобрать заявки')

    expect(router.currentRoute.value.name).toBe('enrollments')
  })

  it('says a count could not be read rather than reporting an empty queue', async () => {
    signIn(['enrollments:read', 'homework:read'])

    const { page } = await open({
      [ENROLLMENTS]: refusal(403, 'Forbidden'),
      [HOMEWORK]: rows(2),
    })

    expect(page.text()).toContain('Не удалось посчитать')
    expect(page.text()).toContain('2')
  })

  it('keeps one refused count from taking the other down with it', async () => {
    signIn(['enrollments:read', 'homework:read'])

    const { page } = await open({ [HOMEWORK]: refusal(500, 'Boom'), [ENROLLMENTS]: rows(3) })

    expect(page.text()).toContain('3')
  })

  it('offers a way into courses without pretending a course is overdue', async () => {
    signIn(['courses:read'])

    const { page } = await open()

    expect(page.text()).toContain('Курсы и уроки')
    expect(page.text()).toContain('Открыть курсы')
  })
})
