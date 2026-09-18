import '../../../../../../libs/ui/vitest.setup'

import type { PermissionKey } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setAppRouter, useCurrentSchool } from '@/shared/access'
import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, mountWithApp, pending, refusal } from '@/shared/testing'

import { messages } from '../i18n'
import EnrollmentsPage from '../ui/EnrollmentsPage.vue'

const ENROLLMENTS = '/edu/enrollments'
const COURSES = '/edu/courses'
const GROUPS = '/edu/groups'

const blank = { template: '<div />' }

const signIn = (permissions: PermissionKey[], schools = ['school-1']) => {
  const claims = {
    sub: 'u9',
    exp: 2_000_000_000,
    permissions: schools.map((sid) => ({ sid, p: permissions })),
  }
  useSession().start({ accessToken: `h.${btoa(JSON.stringify(claims))}.s`, refreshToken: 'r' })
}

const summary = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  courseId: 'c1',
  status: 'pending',
  createdAt: '2026-09-01T10:00:00.000Z',
  ...over,
})

const details = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  courseId: 'c1',
  studentId: 'u1',
  schoolId: 'school-1',
  status: 'pending',
  createdAt: '2026-09-01T10:00:00.000Z',
  ...over,
})

const world = (over: FakeAnswers = {}): FakeAnswers => ({
  [COURSES]: { items: [{ id: 'c1', name: 'Основы' }] },
  [GROUPS]: { items: [{ id: 'g1', name: 'Утренняя' }] },
  [ENROLLMENTS]: { items: [summary()] },
  [`${ENROLLMENTS}/e1`]: details(),
  '/edu/users/u1': { id: 'u1', name: 'Аня Иванова', email: 'a@example.com', roles: [] },
  ...over,
})

const mountPage = async (answers: FakeAnswers, settle = true) => {
  const transport = fakeHttpClient(answers)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/s/:schoolId/enrollments', name: 'enrollments', component: blank }],
  })
  setAppRouter(router)
  await router.push('/s/school-1/enrollments')
  await router.isReady()

  const page = mountWithApp(EnrollmentsPage, {
    global: { plugins: [router], provide: { [httpClientKey as symbol]: transport.client } },
  })

  if (settle) await flushPromises()
  return { transport, page }
}

const nameOf = (button: { text: () => string; attributes: (name: string) => string | undefined }) =>
  button.attributes('aria-label') ?? button.text()

const click = async (page: Awaited<ReturnType<typeof mountPage>>['page'], label: string) => {
  const button = page.findAll('button').find((candidate) => nameOf(candidate) === label)
  await button?.trigger('click')
  await flushPromises()
}

describe('EnrollmentsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    addMessages(messages)
    signIn(['enrollments:read', 'enrollments:moderate', 'users:read'] as PermissionKey[])
  })

  it('shows that it is loading while the list is on its way', async () => {
    const { page } = await mountPage(world({ [ENROLLMENTS]: pending() }), false)

    expect(page.find('[role="status"]').exists()).toBe(true)
  })

  it('names the student the summary does not carry', async () => {
    const { transport, page } = await mountPage(world())

    expect(page.text()).toContain('Аня Иванова')
    expect(page.text()).toContain('Основы')
    expect(transport.callsTo('/edu/users/u1')).toHaveLength(1)
  })

  it('reads one enrolment and one person however many rows share them', async () => {
    const { transport } = await mountPage(
      world({
        [ENROLLMENTS]: { items: [summary(), summary({ id: 'e1' })] },
      }),
    )

    expect(transport.callsTo(`${ENROLLMENTS}/e1`)).toHaveLength(1)
    expect(transport.callsTo('/edu/users/u1')).toHaveLength(1)
  })

  it('accepts a request with the status the moderation route expects', async () => {
    const { transport, page } = await mountPage(
      world({ 'PATCH /edu/enrollments/e1/moderation': details({ status: 'accepted' }) }),
    )

    await click(page, 'Принять')

    expect(transport.calls.find((call) => call.method === 'PATCH')).toMatchObject({
      path: `${ENROLLMENTS}/e1/moderation`,
      body: { status: 'accepted' },
    })
  })

  it('declines only after the consequence has been named', async () => {
    const { transport, page } = await mountPage(
      world({ 'PATCH /edu/enrollments/e1/moderation': details({ status: 'declined' }) }),
    )

    await click(page, 'Отклонить')

    expect(transport.calls.some((call) => call.method === 'PATCH')).toBe(false)
    expect(document.body.textContent).toContain('Решение не изменить')

    const confirm = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Отклонить',
    )
    confirm?.click()
    await flushPromises()

    expect(transport.calls.find((call) => call.method === 'PATCH')).toMatchObject({
      body: { status: 'declined' },
    })
  })

  it('shows an accepted request without a group as waiting in the queue', async () => {
    const { page } = await mountPage(
      world({
        [ENROLLMENTS]: { items: [summary({ status: 'accepted' })] },
        [`${ENROLLMENTS}/e1`]: details({ status: 'accepted' }),
      }),
    )

    expect(page.text()).toContain('В очереди')
  })

  it('offers the change back once a group has been assigned', async () => {
    const { page } = await mountPage(
      world({
        [ENROLLMENTS]: { items: [summary({ status: 'accepted', groupId: 'g1' })] },
        [`${ENROLLMENTS}/e1`]: details({ status: 'accepted', groupId: 'g1' }),
        'PATCH /edu/enrollments/e1/group': details({ status: 'accepted', groupId: 'g1' }),
      }),
    )

    await click(page, 'Группа')

    const save = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Определить',
    )
    save?.click()
    await flushPromises()

    expect(document.body.textContent).toContain('Вернуть как было')
  })

  it('places a student in a group through the group route', async () => {
    const { transport, page } = await mountPage(
      world({
        [ENROLLMENTS]: { items: [summary({ status: 'accepted', groupId: 'g1' })] },
        [`${ENROLLMENTS}/e1`]: details({ status: 'accepted', groupId: 'g1' }),
        'PATCH /edu/enrollments/e1/group': details({ status: 'accepted', groupId: 'g1' }),
      }),
    )

    await click(page, 'Группа')

    const save = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Определить',
    )
    save?.click()
    await flushPromises()

    expect(transport.calls.find((call) => call.method === 'PATCH')).toMatchObject({
      path: `${ENROLLMENTS}/e1/group`,
      body: { groupId: 'g1' },
    })
  })

  it('says what to do next when nobody has asked', async () => {
    const { page } = await mountPage(world({ [ENROLLMENTS]: { items: [] } }))

    expect(page.text()).toContain('Заявок нет')
    expect(page.text()).toContain('из приложения')
  })

  it('shows the reason the server gave and offers another attempt', async () => {
    const { transport, page } = await mountPage(
      world({ [ENROLLMENTS]: refusal(500, 'База недоступна') }),
    )

    expect(page.find('[role="alert"]').text()).not.toContain('База недоступна')
    expect(page.find('[role="alert"]').text()).toContain('Сервер не смог это выполнить')

    await click(page, 'Повторить')

    expect(transport.callsTo(ENROLLMENTS).length).toBeGreaterThan(1)
  })

  it('drops the rows of the school left behind and asks again', async () => {
    useSession().end()
    signIn(['enrollments:read', 'enrollments:moderate', 'users:read'] as PermissionKey[], [
      'school-1',
      'school-2',
    ])

    const { transport } = await mountPage(world())
    expect(transport.callsTo(ENROLLMENTS)).toHaveLength(1)

    useCurrentSchool().select('school-2' as never)
    await flushPromises()

    expect(transport.callsTo(ENROLLMENTS)).toHaveLength(2)
    expect(transport.callsTo(COURSES).at(-1)).toMatchObject({ query: { schoolId: 'school-2' } })
  })

  it('draws no decision without the right to moderate', async () => {
    useSession().end()
    signIn(['enrollments:read', 'users:read'] as PermissionKey[])

    const { page } = await mountPage(world())

    const labels = page.findAll('button').map(nameOf)
    expect(labels).not.toContain('Принять')
    expect(labels).not.toContain('Отклонить')
  })
})
