import type { PermissionKey } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages, translate } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, mountWithApp, pending, refusal } from '@/shared/testing'

import { messages } from '../i18n'
import SchoolsPage from '../ui/SchoolsPage.vue'

const SCHOOLS = '/edu/schools'

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
      { path: '/schools/new', name: 'school-new', component: blank },
      { path: '/schools/:id', name: 'school-edit', component: blank },
    ],
  })

const mountPage = async (answers: FakeAnswers, settle = true) => {
  const transport = fakeHttpClient(answers)
  const router = testRouter()
  await router.push('/schools')
  await router.isReady()

  const page = mountWithApp(SchoolsPage, {
    global: { plugins: [router], provide: { [httpClientKey as symbol]: transport.client } },
  })

  if (settle) await flushPromises()
  return { transport, page, router }
}

describe('SchoolsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    addMessages(messages)
    signIn(['schools:read', 'schools:create', 'schools:update'] as PermissionKey[])
  })

  it('shows that it is loading while the list is on its way', async () => {
    const { page } = await mountPage({ [SCHOOLS]: pending() }, false)

    expect(page.find('[role="status"]').exists()).toBe(true)
  })

  it('lists the schools the token allows', async () => {
    const { page } = await mountPage({ [SCHOOLS]: { items: [{ id: 'school-1', name: 'First' }] } })

    expect(page.text()).toContain('First')
  })

  it('says what to do next when there is no school yet', async () => {
    const { page } = await mountPage({ [SCHOOLS]: { items: [] } })

    expect(page.text()).toContain(translate('schools-empty-title'))
    expect(page.text()).toContain(translate('schools-create'))
  })

  it('shows the reason the server gave and offers another attempt', async () => {
    const { transport, page } = await mountPage({ [SCHOOLS]: refusal(503, 'Try again later') })

    expect(page.find('[role="alert"]').text()).not.toContain('Try again later')
    expect(page.find('[role="alert"]').text()).toContain(translate('state-error'))

    const retry = page
      .findAll('button')
      .find((button) => button.text() === translate('action-retry'))
    await retry?.trigger('click')
    await flushPromises()

    expect(transport.calls).toHaveLength(2)
  })

  it('does not draw the create button without the right to create', async () => {
    useSession().end()
    signIn(['schools:read'] as PermissionKey[])

    const { page } = await mountPage({ [SCHOOLS]: { items: [{ id: 'school-1', name: 'First' }] } })

    const labels = page
      .findAll('button')
      .map((button) => button.attributes('aria-label') ?? button.text())

    expect(labels).not.toContain(translate('schools-form-create-title'))
  })

  it('leads to the edit page of a school that may be changed', async () => {
    const { page, router } = await mountPage({
      [SCHOOLS]: { items: [{ id: 'school-1', name: 'First' }] },
    })

    const row = page.find('tbody tr')
    await row?.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('school-edit')
  })
})
