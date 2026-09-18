import type { SchoolId } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'

import { resetSchoolNames } from '@/features/switch-school'
import { httpClientKey } from '@/shared/api'
import { useSession } from '@/shared/session'
import { fakeHttpClient, mountWithApp } from '@/shared/testing'

import App from '../App.vue'
import { createI18n } from '../i18n'
import { requireSession, skipLoginWhenSignedIn } from '../router/guards'
import { sectionRoutes } from '../sections'

const school = (value: string) => value as unknown as SchoolId

const SCHOOL_A = school('11111111-1111-1111-1111-111111111111')
const SCHOOLS = '/edu/schools'

const token = (permissions: unknown) =>
  `header.${btoa(JSON.stringify({ sub: 'u1', exp: 2_000_000_000, permissions }))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')}.sig`

const signIn = () =>
  useSession().start({
    accessToken: token([{ sid: SCHOOL_A, p: ['*'] }]),
    refreshToken: 'refresh',
  })

const mountApp = async (at: string) => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: sectionRoutes() as RouteRecordRaw[],
  })
  router.beforeEach(skipLoginWhenSignedIn)
  router.beforeEach(requireSession)

  const transport = fakeHttpClient({ [SCHOOLS]: { items: [{ id: SCHOOL_A, name: 'My School' }] } })

  await router.push(at)
  await router.isReady()

  const app = mountWithApp(App, {
    global: {
      plugins: [router],
      provide: { [httpClientKey as symbol]: transport.client },

      // The real router is installed here, so the real links are wanted: a
      // stubbed RouterLink renders none of its label, and a sidebar whose
      // entries are invisible is exactly what this is checking for.
      stubs: { RouterLink: false },
    },
  })

  await flushPromises()
  return { app, router, transport }
}

describe('the assembled application', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSchoolNames()
    useSession().end()
    createI18n()
  })

  it('shows the sign-in screen, without the shell around it', async () => {
    const { app, router } = await mountApp('/')

    expect(router.currentRoute.value.name).toBe('login')
    expect(app.find('input[name="email"]').exists()).toBe(true)
    expect(app.find('aside').exists()).toBe(false)
  })

  it('lands on the dashboard inside the shell, with the school in the switcher', async () => {
    signIn()
    const { app, router } = await mountApp('/')

    expect(router.currentRoute.value.name).toBe('dashboard')
    expect(app.find('aside').exists()).toBe(true)
    expect(app.text()).toContain('Главная')
    expect(app.text()).toContain('My School')
  })

  it('shows the dashboard in the sidebar, because its menu entry needs nothing', async () => {
    signIn()
    const { app } = await mountApp('/')

    expect(app.find('nav').text()).toContain('Главная')
  })

  it('ends the session and returns to sign-in when the operator signs out', async () => {
    signIn()
    const { app, router } = await mountApp('/')

    await app.find('aside button').trigger('click')
    await flushPromises()

    expect(useSession().isSignedIn.value).toBe(false)
    expect(router.currentRoute.value.name).toBe('login')
    expect(localStorage.getItem('vidya.admin.refreshToken')).toBeNull()
  })

  it('shows the not-found screen for an address no section owns', async () => {
    signIn()
    const { app, router } = await mountApp('/nothing/here')

    expect(router.currentRoute.value.name).toBe('not-found')
    expect(app.text()).toContain('Страница не найдена')
  })
})
