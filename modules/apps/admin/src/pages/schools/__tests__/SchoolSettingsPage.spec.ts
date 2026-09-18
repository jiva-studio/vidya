import type { PermissionKey } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, mountWithApp, pending, refusal } from '@/shared/testing'

import { messages } from '../i18n'
import SchoolSettingsPage from '../ui/SchoolSettingsPage.vue'

const CONFIGS = '/edu/schools/school-1/configs'
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
      { path: '/schools', name: 'schools', component: blank },
      { path: '/schools/:id/settings', name: 'school-settings', component: blank },
    ],
  })

const mountPage = async (answers: FakeAnswers, settle = true) => {
  const transport = fakeHttpClient(answers)
  const router = testRouter()
  await router.push('/schools/school-1/settings')
  await router.isReady()

  const page = mountWithApp(SchoolSettingsPage, {
    props: { id: 'school-1' },
    global: { plugins: [router], provide: { [httpClientKey as symbol]: transport.client } },
  })

  if (settle) await flushPromises()
  return { transport, page }
}

const roles = { items: [{ id: 'role-1', name: 'Student', description: '' }] }

describe('SchoolSettingsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    addMessages(messages)
    signIn(['schools:read', 'schools:update', 'roles:read'] as PermissionKey[])
  })

  it('shows that it is loading', async () => {
    const { page } = await mountPage({ [CONFIGS]: pending(), [ROLES]: pending() }, false)

    expect(page.find('[role="status"]').exists()).toBe(true)
  })

  it('asks the roles of the school in the address, not of the one in the switcher', async () => {
    const { transport } = await mountPage({
      [CONFIGS]: { studentRoleIds: [] },
      [ROLES]: roles,
    })

    expect(transport.callsTo(ROLES)[0].query).toEqual({ schoolId: 'school-1' })
  })

  it('sends the settings the operator ticked', async () => {
    const { transport, page } = await mountPage({
      [CONFIGS]: { defaultStudentRoleId: 'role-1', studentRoleIds: [] },
      [ROLES]: roles,
      [`PATCH ${CONFIGS}`]: { success: true },
    })

    await page.find('[role="checkbox"]').trigger('click')
    await flushPromises()

    const save = page.findAll('button').find((button) => button.text() === 'Сохранить')
    await save?.trigger('click')
    await flushPromises()

    expect(transport.calls.at(-1)).toEqual({
      method: 'PATCH',
      path: CONFIGS,
      body: { defaultStudentRoleId: 'role-1', studentRoleIds: ['role-1'] },
    })
  })

  it('points at creating a role when the school has none', async () => {
    const { page } = await mountPage({ [CONFIGS]: { studentRoleIds: [] }, [ROLES]: { items: [] } })

    expect(page.text()).toContain('В этой школе ещё нет ролей')
  })

  it('shows the reason the server gave and offers another attempt', async () => {
    const { transport, page } = await mountPage({
      [CONFIGS]: refusal(500, 'Settings are unreadable'),
      [ROLES]: roles,
    })

    expect(page.find('[role="alert"]').text()).not.toContain('Settings are unreadable')
    expect(page.find('[role="alert"]').text()).toContain('Сервер не смог это выполнить')

    const retry = page.findAll('button').find((button) => button.text() === 'Повторить')
    await retry?.trigger('click')
    await flushPromises()

    expect(transport.callsTo(CONFIGS)).toHaveLength(2)
  })
})
