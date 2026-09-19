import type { PermissionKey } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, mountWithApp, refusal } from '@/shared/testing'

import { messages } from '../i18n'
import UserCardPage from '../ui/UserCardPage.vue'

const USER = '/edu/users/user-1'
const USER_ROLES = '/edu/users/user-1/roles'
const USER_SCHOOLS = '/edu/users/user-1/schools'

const blank = { template: '<div />' }

const signIn = (permissions: PermissionKey[]) => {
  const claims = {
    sub: 'u1',
    exp: 2_000_000_000,
    permissions: [{ sid: 'school-1', p: permissions }],
  }
  useSession().start({ accessToken: `h.${btoa(JSON.stringify(claims))}.s`, refreshToken: 'r' })
}

const card = {
  [USER]: { id: 'user-1', name: 'Ann', email: 'ann@example.com', roles: [] },
  [USER_ROLES]: { userRoles: [{ roleId: 'role-1' }] },
  [`POST ${USER_ROLES}`]: {},
  [USER_SCHOOLS]: { userSchools: ['school-1'] },
  '/edu/roles': {
    items: [
      { id: 'role-1', name: 'Teacher', description: '' },
      { id: 'role-2', name: 'Student', description: '' },
    ],
  },
  '/edu/schools': { items: [{ id: 'school-1', name: 'First' }] },
}

const testRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/users', name: 'users', component: blank },
      { path: '/users/:id', name: 'user', component: blank },
    ],
  })

const mountPage = async (answers: FakeAnswers) => {
  const transport = fakeHttpClient(answers)
  const router = testRouter()
  await router.push('/users/user-1')
  await router.isReady()

  const page = mountWithApp(UserCardPage, {
    props: { id: 'user-1' },
    global: { plugins: [router], provide: { [httpClientKey as symbol]: transport.client } },
  })

  await flushPromises()
  return { transport, page }
}

describe('UserCardPage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    addMessages(messages)
    signIn(['users:read', 'users:update', 'roles:read', 'schools:read'] as PermissionKey[])
  })

  it('shows the fields the schema holds and none it does not', async () => {
    const { page } = await mountPage(card)

    expect(page.text()).toContain('Ann')
    expect((page.find('input[name="email"]').element as HTMLInputElement).value).toBe(
      'ann@example.com',
    )
    expect(page.find('input[name="department"]').exists()).toBe(false)
    expect(page.find('input[name="title"]').exists()).toBe(false)
  })

  it('gives a role, and the card shows it without being reloaded', async () => {
    const { transport, page } = await mountPage(card)

    const boxes = page.findAll('[role="checkbox"]')
    expect(boxes[0].attributes('aria-checked')).toBe('true')
    expect(boxes[1].attributes('aria-checked')).toBe('false')

    await boxes[1].trigger('click')
    await flushPromises()

    expect(transport.calls.at(-1)).toEqual({
      method: 'POST',
      path: USER_ROLES,
      body: { roleIds: ['role-1', 'role-2'] },
    })
    expect(page.findAll('[role="checkbox"]')[1].attributes('aria-checked')).toBe('true')
  })

  it('takes a role away by sending the set without it', async () => {
    const { transport, page } = await mountPage(card)

    await page.findAll('[role="checkbox"]')[0].trigger('click')
    await flushPromises()

    expect(transport.calls.at(-1)).toEqual({
      method: 'POST',
      path: USER_ROLES,
      body: { roleIds: [] },
    })
    expect(page.findAll('[role="checkbox"]')[0].attributes('aria-checked')).toBe('false')
  })

  it('does not offer the roles as controls to someone who may not change them', async () => {
    useSession().end()
    signIn(['users:read', 'roles:read', 'schools:read'] as PermissionKey[])

    const { page } = await mountPage(card)

    expect(page.findAll('[role="checkbox"]')).toHaveLength(0)
    expect(page.find('input[name="email"]').exists()).toBe(false)
    expect(page.text()).toContain('Teacher')
  })

  it('shows the reason the server gave and offers another attempt', async () => {
    const { transport, page } = await mountPage({
      ...card,
      [USER]: refusal(404, 'No such person'),
    })

    expect(page.find('[role="alert"]').text()).toContain('No such person')

    const retry = page.findAll('button').find((button) => button.text() === 'Повторить')
    await retry?.trigger('click')
    await flushPromises()

    expect(transport.callsTo(USER)).toHaveLength(2)
  })
})
