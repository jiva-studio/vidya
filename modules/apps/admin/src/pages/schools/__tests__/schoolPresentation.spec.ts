import type { PermissionKey } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, mountWithApp } from '@/shared/testing'

import { messages } from '../i18n'
import SchoolFormPage from '../ui/SchoolFormPage.vue'
import SchoolLogoField from '../ui/SchoolLogoField.vue'

const SCHOOLS = '/edu/schools'
const LOGO = 'https://cdn.example.org/logo.png'
const ABOUT = 'Scripture, kirtan and practice.'

const blank = { template: '<div />' }

const signIn = () => {
  const claims = {
    sub: 'u1',
    exp: 2_000_000_000,
    permissions: [{ sid: 'school-1', p: ['schools:create', 'schools:update'] as PermissionKey[] }],
  }
  useSession().start({ accessToken: `h.${btoa(JSON.stringify(claims))}.s`, refreshToken: 'r' })
}

const mountForm = async (answers: FakeAnswers, props: Record<string, unknown> = {}) => {
  const transport = fakeHttpClient(answers)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/schools', name: 'schools', component: blank },
      { path: '/schools/new', name: 'school-new', component: blank },
    ],
  })
  await router.push('/schools/new')
  await router.isReady()

  const page = mountWithApp(SchoolFormPage, {
    props,
    global: { plugins: [router], provide: { [httpClientKey as symbol]: transport.client } },
  })

  await flushPromises()
  return { transport, page }
}

const save = async (page: Awaited<ReturnType<typeof mountForm>>['page']) => {
  await page.find('form').trigger('submit')
  await flushPromises()
}

const sent = (transport: Awaited<ReturnType<typeof mountForm>>['transport']) =>
  transport.calls.find(
    (call) =>
      call.method === 'POST' ||
      (call.method === 'PATCH' && call.path.startsWith(SCHOOLS) && !call.path.includes('configs')),
  )

/**
 * Without a way in, a logo and a description can only be put there by a seed or
 * by hand in SQL — and the student's catalogue is drawn from both.
 */
describe('the logo and the description of a school', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    addMessages(messages)
    signIn()
  })

  it('reaches the server when a school is created with them', async () => {
    const { transport, page } = await mountForm({ 'POST /edu/schools': { id: 'school-2' } })

    await page.find('input[name="name"]').setValue('Second')
    page.findComponent(SchoolLogoField).vm.$emit('update:modelValue', LOGO)
    await page.find('textarea').setValue(ABOUT)
    await save(page)

    expect(sent(transport)).toEqual({
      method: 'POST',
      path: SCHOOLS,
      body: { name: 'Second', logoUrl: LOGO, description: ABOUT },
    })
  })

  it('comes back into the form of a school being edited', async () => {
    const { page } = await mountForm(
      {
        '/edu/schools/school-1': {
          id: 'school-1',
          name: 'First',
          logoUrl: LOGO,
          description: ABOUT,
        },
      },
      { id: 'school-1' },
    )

    expect(page.findComponent(SchoolLogoField).props('modelValue')).toBe(LOGO)
    expect((page.find('textarea').element as HTMLTextAreaElement).value).toBe(ABOUT)
  })

  it('is cleared by removing the logo, which is not the same as leaving it alone', async () => {
    const { transport, page } = await mountForm(
      {
        '/edu/schools/school-1': {
          id: 'school-1',
          name: 'First',
          logoUrl: LOGO,
          description: ABOUT,
        },
        'PATCH /edu/schools/school-1': { id: 'school-1', name: 'First' },
      },
      { id: 'school-1' },
    )

    page.findComponent(SchoolLogoField).vm.$emit('update:modelValue', '')
    await save(page)

    expect(sent(transport)?.body).toMatchObject({ logoUrl: null, description: ABOUT })
  })

  it('accepts media storage paths for logo without error', async () => {
    const { transport, page } = await mountForm({ 'POST /edu/schools': { id: 'school-2' } })

    await page.find('input[name="name"]').setValue('Second')
    page
      .findComponent(SchoolLogoField)
      .vm.$emit('update:modelValue', '/media/f8abdc11-3c0b-480e-a7e3-50789fe7ca2a')
    await save(page)

    expect(sent(transport)).toEqual({
      method: 'POST',
      path: SCHOOLS,
      body: {
        name: 'Second',
        logoUrl: '/media/f8abdc11-3c0b-480e-a7e3-50789fe7ca2a',
        description: null,
      },
    })
  })
})
