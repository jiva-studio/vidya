import type { PermissionKey } from '@vidya/domain'
import { PermissionKeys } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, mountWithApp, refusal } from '@/shared/testing'

import { messages } from '../i18n'
import RoleFormPage from '../ui/RoleFormPage.vue'

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
    ],
  })

const mountForm = async (answers: FakeAnswers, props: Record<string, unknown> = {}) => {
  const transport = fakeHttpClient(answers)
  const router = testRouter()
  await router.push('/roles/new')
  await router.isReady()

  const page = mountWithApp(RoleFormPage, {
    props,
    global: { plugins: [router], provide: { [httpClientKey as symbol]: transport.client } },
  })

  await flushPromises()
  return { transport, page }
}

const save = async (page: Awaited<ReturnType<typeof mountForm>>['page']) => {
  const button = page.findAll('button').find((candidate) => candidate.text() === 'Сохранить')
  await button?.trigger('click')
  await flushPromises()
}

describe('RoleFormPage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    addMessages(messages)
    signIn(['roles:create', 'roles:update'] as PermissionKey[])
  })

  it('offers every permission the domain declares, and no list of its own', async () => {
    const { page } = await mountForm({ 'POST /edu/roles': { id: 'role-1' } })

    expect(page.findAll('[role="checkbox"]')).toHaveLength(PermissionKeys.length)
  })

  it('groups them by the resource they act on', async () => {
    const { page } = await mountForm({ 'POST /edu/roles': { id: 'role-1' } })

    const legends = page.findAll('legend').map((legend) => legend.text())

    expect(legends).toContain('Роли')
    expect(legends).toContain('Домашние работы')
  })

  it('sends exactly the permissions that were ticked', async () => {
    const { transport, page } = await mountForm({ 'POST /edu/roles': { id: 'role-1' } })

    await page.find('input[name="name"]').setValue('Teacher')

    const boxes = page.findAll('[role="checkbox"]')
    await boxes[1].trigger('click')
    await boxes[2].trigger('click')
    await flushPromises()

    await save(page)

    expect(transport.calls[0]).toEqual({
      method: 'POST',
      path: ROLES,
      body: {
        name: 'Teacher',
        description: '',
        permissions: [PermissionKeys[1], PermissionKeys[2]],
        schoolId: 'school-1',
      },
    })
  })

  it('sends nothing until the role has a name', async () => {
    const { transport, page } = await mountForm({ 'POST /edu/roles': { id: 'role-1' } })

    await save(page)

    expect(transport.calls).toHaveLength(0)
    expect(page.text()).toContain('У роли должно быть название')
  })

  it('loads the role it is editing and patches it', async () => {
    const { transport, page } = await mountForm(
      {
        '/edu/roles/role-1': {
          id: 'role-1',
          name: 'Teacher',
          description: 'Runs a group',
          schoolId: 'school-1',
          permissions: ['homework:grade'],
        },
        'PATCH /edu/roles/role-1': { id: 'role-1' },
      },
      { id: 'role-1' },
    )

    expect((page.find('input[name="name"]').element as HTMLInputElement).value).toBe('Teacher')

    await save(page)

    expect(transport.calls[1]).toEqual({
      method: 'PATCH',
      path: '/edu/roles/role-1',
      body: { name: 'Teacher', description: 'Runs a group', permissions: ['homework:grade'] },
    })
  })

  it('shows the reason the server gave instead of a generic failure', async () => {
    const { page } = await mountForm({
      'POST /edu/roles': refusal(409, 'A role with this name already exists'),
    })

    await page.find('input[name="name"]').setValue('Teacher')
    await save(page)

    expect(page.text()).toContain('A role with this name already exists')
  })
})
