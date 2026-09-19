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

const boxOf = (page: Awaited<ReturnType<typeof mountForm>>['page'], key: string) =>
  page.find(`[data-permission="${key}"] [role="checkbox"]`)

const tick = async (page: Awaited<ReturnType<typeof mountForm>>['page'], key: string) => {
  await boxOf(page, key).trigger('click')
  await flushPromises()
}

const flip = async (page: Awaited<ReturnType<typeof mountForm>>['page']) => {
  await page.find('[role="switch"]').trigger('click')
  await flushPromises()
}

const whole = async (page: Awaited<ReturnType<typeof mountForm>>['page'], prefix: string) => {
  await page.find(`[data-permission-group="${prefix}"] [role="checkbox"]`).trigger('click')
  await flushPromises()
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

    const offered = page
      .findAll('[data-permission]')
      .map((box) => box.attributes('data-permission'))

    expect(offered).toEqual([...PermissionKeys].filter((key) => key !== '*'))
  })

  it('lays them out as one list per area, headed by the name of the area', async () => {
    const { page } = await mountForm({ 'POST /edu/roles': { id: 'role-1' } })

    expect(page.text()).toContain('Роли')
    expect(page.text()).toContain('Домашние работы')
    expect(page.text()).toContain('Публикация')
  })

  it('sends exactly the permissions that were ticked', async () => {
    const { transport, page } = await mountForm({ 'POST /edu/roles': { id: 'role-1' } })

    await page.find('input[name="name"]').setValue('Teacher')

    await tick(page, 'courses:read')
    await tick(page, 'homework:grade')

    await save(page)

    expect(transport.calls[0]).toEqual({
      method: 'POST',
      path: ROLES,
      body: {
        name: 'Teacher',
        description: '',
        permissions: ['courses:read', 'homework:grade'],
        schoolId: 'school-1',
      },
    })
  })

  it('takes a whole area at once when its heading is ticked', async () => {
    const { transport, page } = await mountForm({ 'POST /edu/roles': { id: 'role-1' } })

    await page.find('input[name="name"]').setValue('Teacher')

    await whole(page, 'homework')

    await save(page)

    expect(transport.calls[0]).toMatchObject({
      body: { permissions: ['homework:read', 'homework:grade'] },
    })
  })

  it('puts one switch in place of the whole list rather than ticking all of it', async () => {
    const { transport, page } = await mountForm({ 'POST /edu/roles': { id: 'role-1' } })

    await page.find('input[name="name"]').setValue('Teacher')

    await tick(page, 'courses:read')
    await flip(page)

    expect(page.findAll('[data-permission]')).toHaveLength(0)
    expect(page.text()).toContain('Выключите переключатель')

    await save(page)

    expect(transport.calls[0]).toMatchObject({ body: { permissions: ['*'] } })
  })

  it('gives back what was chosen when the switch goes off again', async () => {
    const { page } = await mountForm({ 'POST /edu/roles': { id: 'role-1' } })

    await tick(page, 'courses:read')
    await flip(page)
    await flip(page)

    expect(boxOf(page, 'courses:read').attributes('data-state')).toBe('checked')
  })

  it('shows an odd set exactly as it is, ticking nothing of its own', async () => {
    const { page } = await mountForm(
      {
        '/edu/roles/role-1': {
          id: 'role-1',
          name: 'Odd',
          description: '',
          schoolId: 'school-1',
          permissions: ['courses:delete', 'lessons:publish'],
        },
      },
      { id: 'role-1' },
    )

    expect(boxOf(page, 'courses:delete').attributes('data-state')).toBe('checked')
    expect(boxOf(page, 'courses:read').attributes('data-state')).toBe('unchecked')
    expect(boxOf(page, 'lessons:publish').attributes('data-state')).toBe('checked')
  })

  it('is read-only for someone who may not edit roles', async () => {
    useSession().end()
    signIn([] as PermissionKey[])

    const { page } = await mountForm({ 'POST /edu/roles': { id: 'role-1' } })

    expect(boxOf(page, 'courses:read').attributes('data-disabled')).toBeDefined()
    expect(page.find('[role="switch"]').attributes('data-disabled')).toBeDefined()
    expect(
      page.find('[data-permission-group="courses"] [role="checkbox"]').attributes('data-disabled'),
    ).toBeDefined()
  })

  it('sends nothing until the role has a name', async () => {
    const { transport, page } = await mountForm({ 'POST /edu/roles': { id: 'role-1' } })

    await save(page)

    expect(transport.calls).toHaveLength(0)
    expect(page.text()).toContain('Укажите название.')
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
