import type { PermissionKey } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { PAGE_SIZE } from '@/entities/user'
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

/** Types into the search box and lets its debounce run out. */
const search = async (
  page: { find: (s: string) => { setValue: (v: string) => Promise<unknown> } },
  term: string,
) => {
  await page.find('input[type="search"]').setValue(term)
  await new Promise((resolve) => setTimeout(resolve, 300))
  await flushPromises()
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
      query: { schoolId: 'school-1', limit: PAGE_SIZE, offset: 0, search: undefined },
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

  // The school may hold hundreds, so the term goes to the server rather than
  // the whole list coming back to be sifted here.
  it('hands the search to the server and shows what it answers', async () => {
    const { transport, page } = await mountPage({
      [USERS]: (call: RecordedCall) =>
        call.query?.search === 'Smith'
          ? { items: [{ id: 'user-0', name: 'Ann Smith' }], total: 1 }
          : {
              items: [
                { id: 'user-0', name: 'Ann Smith' },
                { id: 'user-1', name: 'Bob Jones' },
              ],
              total: 2,
            },
    })

    expect(page.text()).toContain('Bob Jones')

    await search(page, 'Smith')

    expect(transport.calls.at(-1)?.query).toMatchObject({ search: 'Smith', offset: 0 })
    expect(page.text()).toContain('Ann Smith')
    expect(page.text()).not.toContain('Bob Jones')
  })

  it('asks for the next page from the offset, and returns to the first on a new search', async () => {
    const { transport, page } = await mountPage({
      [USERS]: {
        items: Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: `u${i}`, name: `User ${i}` })),
        total: PAGE_SIZE * 3,
      },
    })

    const next = page.findAll('button').find((node) => node.text() === '2')
    await next?.trigger('click')
    await flushPromises()

    expect(transport.calls.at(-1)?.query).toMatchObject({ offset: PAGE_SIZE })

    await search(page, 'Ann')

    expect(transport.calls.at(-1)?.query).toMatchObject({ offset: 0 })
  })
  it('says the search matched nobody rather than that the school is empty', async () => {
    const { page } = await mountPage({
      [USERS]: (call: RecordedCall) =>
        call.query?.search
          ? { items: [], total: 0 }
          : {
              items: Array.from({ length: 12 }, (_, i) => ({ id: `user-${i}`, name: `User ${i}` })),
              total: 12,
            },
    })

    await search(page, 'Nobody by that name')

    expect(page.text()).toContain('Никого не нашли')
    expect(page.text()).not.toContain('Здесь пока никого нет')
  })

  it('lets the list use the full width rather than a form column', async () => {
    const { page } = await mountPage({ [USERS]: { items: [{ id: 'user-1', name: 'Ann' }] } })

    expect(page.find('section').classes()).not.toContain('max-w-[var(--form-max)]')
  })
  // `users.name` is nullable in the schema and the wire omits it, so a person
  // with none reaches the table. Reading it eagerly took the whole page down.
  it('lists a person the schema let through without a name', async () => {
    const { page } = await mountPage({
      [USERS]: {
        items: [
          { id: 'user-1', name: 'Ann Smith' },
          { id: 'user-2' },
          { id: 'user-3', name: null },
        ],
      },
    })

    expect(page.text()).toContain('Ann Smith')
    expect(page.text()).toContain('Без имени')
    expect(page.findAll('tbody tr')).toHaveLength(3)
  })

  it('keeps searching usable with a nameless person in the answer', async () => {
    const { page } = await mountPage({
      [USERS]: { items: [{ id: 'user-0', name: 'User 0' }, { id: 'nameless' }], total: 2 },
    })

    await search(page, 'User')

    expect(page.text()).toContain('User 0')
    expect(page.text()).toContain('Без имени')
  })
})
