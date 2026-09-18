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
import SchoolFormPage from '../ui/SchoolFormPage.vue'

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
    ],
  })

const mountForm = async (answers: FakeAnswers, props: Record<string, unknown> = {}) => {
  const transport = fakeHttpClient(answers)
  const router = testRouter()
  await router.push('/schools/new')
  await router.isReady()

  const page = mountWithApp(SchoolFormPage, {
    props,
    global: { plugins: [router], provide: { [httpClientKey as symbol]: transport.client } },
  })

  await flushPromises()
  return { transport, page, router }
}

const save = async (page: Awaited<ReturnType<typeof mountForm>>['page']) => {
  const button = page.findAll('button').find((candidate) => candidate.text() === 'Сохранить')
  await button?.trigger('click')
  await flushPromises()
}

describe('SchoolFormPage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    addMessages(messages)
    signIn(['schools:create', 'schools:update'] as PermissionKey[])
  })

  it('creates a school with the only field the schema holds', async () => {
    const { transport, page, router } = await mountForm({ 'POST /edu/schools': { id: 'school-2' } })

    await page.find('input[name="name"]').setValue('Second')
    await save(page)

    expect(transport.calls[0]).toEqual({
      method: 'POST',
      path: SCHOOLS,
      body: { name: 'Second' },
    })
    expect(router.currentRoute.value.name).toBe('schools')
  })

  it('sends nothing until the school has a name', async () => {
    const { transport, page } = await mountForm({ 'POST /edu/schools': { id: 'school-2' } })

    await save(page)

    expect(transport.calls).toHaveLength(0)
    expect(page.text()).toContain('У школы должно быть название')
  })

  it('loads the school it is editing and patches it', async () => {
    const { transport, page } = await mountForm(
      {
        '/edu/schools/school-1': { id: 'school-1', name: 'First' },
        'PATCH /edu/schools/school-1': { id: 'school-1', name: 'Renamed' },
      },
      { id: 'school-1' },
    )

    expect((page.find('input[name="name"]').element as HTMLInputElement).value).toBe('First')

    await page.find('input[name="name"]').setValue('Renamed')
    await save(page)

    expect(transport.calls[1]).toEqual({
      method: 'PATCH',
      path: '/edu/schools/school-1',
      body: { name: 'Renamed' },
    })
  })

  it('shows the reason the server gave instead of a generic failure', async () => {
    const { page } = await mountForm({
      'POST /edu/schools': refusal(409, 'A school with this name already exists'),
    })

    await page.find('input[name="name"]').setValue('Second')
    await save(page)

    expect(page.text()).toContain('A school with this name already exists')
  })
})
