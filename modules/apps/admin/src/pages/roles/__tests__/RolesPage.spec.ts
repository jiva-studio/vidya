import type { PermissionKey } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages } from '@/shared/i18n'
import { PAGE_SIZE } from '@/shared/lib'
import { useSession } from '@/shared/session'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, mountWithApp, pending, refusal } from '@/shared/testing'

import { messages } from '../i18n'
import RolesPage from '../ui/RolesPage.vue'

const ROLES = '/edu/roles'

const blank = { template: '<div />' }

const signIn = (permissions: PermissionKey[]) => {
  const claims = {
    sub: 'u1',
    exp: 2_000_000_000,
    permissions: [{ sid: 'school-1', p: permissions }],
  }
  useSession().start({ accessToken: `h.${btoa(JSON.stringify(claims))}.s`, refreshToken: 'r' })
}

const testRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/roles', name: 'roles', component: blank },
      { path: '/roles/new', name: 'role-new', component: blank },
      { path: '/roles/:id', name: 'role-edit', component: blank },
    ],
  })

const mountPage = async (answers: FakeAnswers, settle = true) => {
  const transport = fakeHttpClient(answers)
  const router = testRouter()
  await router.push('/roles')
  await router.isReady()

  const page = mountWithApp(RolesPage, {
    global: { plugins: [router], provide: { [httpClientKey as symbol]: transport.client } },
  })

  if (settle) await flushPromises()
  return { transport, page, router }
}

describe('RolesPage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    addMessages(messages)
    signIn(['roles:read', 'roles:create', 'roles:update'] as PermissionKey[])
  })

  it('shows that it is loading while the list is on its way', async () => {
    const { page } = await mountPage({ [ROLES]: pending() }, false)

    expect(page.find('[role="status"]').exists()).toBe(true)
  })

  it('lists the roles of the current school', async () => {
    const { transport, page } = await mountPage({
      [ROLES]: { items: [{ id: 'role-1', name: 'Teacher', description: 'Runs a group' }] },
    })

    expect(transport.calls[0]).toEqual({
      method: 'GET',
      path: ROLES,
      query: { schoolId: 'school-1', limit: PAGE_SIZE, offset: 0 },
    })
    expect(page.text()).toContain('Teacher')
    expect(page.text()).toContain('Runs a group')
  })

  it('says what to do next when there is no role yet', async () => {
    const { page } = await mountPage({ [ROLES]: { items: [] } })

    expect(page.text()).toContain('Ролей пока нет')
    expect(page.text()).toContain('Создайте роль')
  })

  it("keeps the server's own words out of a failure and offers another attempt", async () => {
    const { transport, page } = await mountPage({ [ROLES]: refusal(500, 'The database is away') })

    const alert = page.find('[role="alert"]').text()

    expect(alert).not.toContain('The database is away')
    expect(alert).toContain('Не получилось. Попробуйте ещё раз.')

    const retry = page.findAll('button').find((button) => button.text() === 'Повторить')
    await retry?.trigger('click')
    await flushPromises()

    expect(transport.calls).toHaveLength(2)
  })

  it('does not draw the create button without the right to create', async () => {
    useSession().end()
    signIn(['roles:read'] as PermissionKey[])

    const { page } = await mountPage({ [ROLES]: { items: [] } })

    expect(page.findAll('button').map((button) => button.text())).not.toContain('Создать роль')
  })

  it('draws it for someone who may create a role', async () => {
    const { page } = await mountPage({ [ROLES]: { items: [] } })

    expect(page.findAll('button').map((button) => button.text())).toContain('Создать роль')
  })
})
