import type { PermissionKey } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setAppRouter, useCurrentSchool } from '@/shared/access'
import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import type { FakeAnswers, RecordedCall } from '@/shared/testing'
import { fakeHttpClient, mountWithApp, pending, refusal } from '@/shared/testing'

import { messages } from '../i18n'
import UsersPage from '../ui/UsersPage.vue'

const USERS = '/edu/users'

const blank = { template: '<div />' }

const signIn = (schools: string[]) => {
  const permissions = schools.map((sid) => ({ sid, p: ['users:read'] as PermissionKey[] }))
  const claims = { sub: 'u1', exp: 2_000_000_000, permissions }
  useSession().start({ accessToken: `h.${btoa(JSON.stringify(claims))}.s`, refreshToken: 'r' })
}

const testRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/s/:schoolId/users', name: 'users', component: blank },
      { path: '/s/:schoolId/users/:id', name: 'user', component: blank },
    ],
  })

const mountPage = async (answers: FakeAnswers, settle = true) => {
  const transport = fakeHttpClient(answers)
  const router = testRouter()
  setAppRouter(router)
  await router.push('/s/school-1/users')
  await router.isReady()

  const page = mountWithApp(UsersPage, {
    global: { plugins: [router], provide: { [httpClientKey as symbol]: transport.client } },
  })

  if (settle) await flushPromises()
  return { transport, page, router }
}

describe('UsersPage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    addMessages(messages)
    signIn(['school-1'])
  })

  it('shows that it is loading while the list is on its way', async () => {
    const { page } = await mountPage({ [USERS]: pending() }, false)

    expect(page.find('[role="status"]').exists()).toBe(true)
  })

  it('asks for the people of the current school', async () => {
    const { transport, page } = await mountPage({
      [USERS]: { items: [{ id: 'user-1', name: 'Ann' }] },
    })

    expect(transport.calls[0]).toEqual({
      method: 'GET',
      path: USERS,
      query: { schoolId: 'school-1' },
    })
    expect(page.text()).toContain('Ann')
  })

  it('drops the previous school and asks again when the school changes', async () => {
    signIn(['school-1', 'school-2'])

    const { transport, page } = await mountPage({
      [USERS]: (call: RecordedCall) =>
        call.query?.schoolId === 'school-1'
          ? { items: [{ id: 'user-1', name: 'Ann' }] }
          : { items: [{ id: 'user-2', name: 'Bob' }] },
    })

    expect(page.text()).toContain('Ann')

    useCurrentSchool().select('school-2' as never)
    await flushPromises()

    expect(page.text()).not.toContain('Ann')
    expect(page.text()).toContain('Bob')
    expect(transport.calls.map((call) => call.query?.schoolId)).toEqual(['school-1', 'school-2'])
  })

  it('says what to do next when nobody is listed', async () => {
    const { page } = await mountPage({ [USERS]: { items: [] } })

    expect(page.text()).toContain('Здесь пока никого нет')
  })

  it('shows the reason the server gave and offers another attempt', async () => {
    const { transport, page } = await mountPage({ [USERS]: refusal(500, 'People are unreadable') })

    expect(page.find('[role="alert"]').text()).not.toContain('People are unreadable')
    expect(page.find('[role="alert"]').text()).toContain('Не получилось. Попробуйте ещё раз.')

    const retry = page.findAll('button').find((button) => button.text() === 'Повторить')
    await retry?.trigger('click')
    await flushPromises()

    expect(transport.calls).toHaveLength(2)
  })

  it('filters users by search term when list is large', async () => {
    const { page } = await mountPage({
      [USERS]: {
        items: Array.from({ length: 12 }, (_, i) => ({
          id: `user-${i}`,
          name: { 0: 'Ann Smith', 1: 'Bob Jones' }[i] ?? `User ${i}`,
        })),
      },
    })

    expect(page.text()).toContain('Ann Smith')
    expect(page.text()).toContain('Bob Jones')

    const input = page.find('input[type="search"]')
    expect(input.exists()).toBe(true)
    await input.setValue('Smith')
    await new Promise((resolve) => setTimeout(resolve, 300))
    await flushPromises()

    expect(page.text()).toContain('Ann Smith')
    expect(page.text()).not.toContain('Bob Jones')
  })
})
