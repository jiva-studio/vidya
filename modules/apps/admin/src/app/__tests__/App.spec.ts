import type { SchoolId } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'

import { resetSchoolNames } from '@/features/switch-school'
import { useCurrentSchool } from '@/shared/access'
import { httpClientKey } from '@/shared/api'
import { locale } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import { fakeHttpClient, mountWithApp } from '@/shared/testing'

import App from '../App.vue'
import { createI18n } from '../i18n'
import { requireSession, skipLoginWhenSignedIn } from '../router/guards'
import { sectionRoutes } from '../sections'

// This file reads the assembled application in Russian, and the language is
// remembered between visits, so it is said here rather than inherited from
// whatever the last suite in this worker chose.
locale.value = 'ru'

const school = (value: string) => value as unknown as SchoolId

const SCHOOL_A = school('11111111-1111-1111-1111-111111111111')
const SCHOOL_B = school('22222222-2222-2222-2222-222222222222')
const SCHOOLS = '/edu/schools'

const token = (permissions: unknown) =>
  `header.${btoa(JSON.stringify({ sub: 'u1', exp: 2_000_000_000, permissions }))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')}.sig`

const signIn = (schools: SchoolId[] = [SCHOOL_A]) =>
  useSession().start({
    accessToken: token(schools.map((sid) => ({ sid, p: ['*'] }))),
    refreshToken: 'refresh',
  })

const mountApp = async (at: string) => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: sectionRoutes() as RouteRecordRaw[],
  })
  router.beforeEach(skipLoginWhenSignedIn)
  router.beforeEach(requireSession)

  const transport = fakeHttpClient({
    [SCHOOLS]: { items: [{ id: SCHOOL_A, name: 'My School' }] },

    // Enough for the screens these tests open; each says what it is for.
    '/edu/courses': { items: [] },
    '/edu/courses/c1': { id: 'c1', name: 'A course', description: '', learningType: 'group' },
    '/edu/groups': { items: [] },
  })

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

    const signOut = app.findAll('aside button').find((node) => node.text() === 'Выйти')
    await signOut?.trigger('click')
    await flushPromises()

    expect(useSession().isSignedIn.value).toBe(false)
    expect(router.currentRoute.value.name).toBe('login')
    expect(localStorage.getItem('vidya.admin.refreshToken')).toBeNull()
  })

  it('leaves a record of the old school when the school changes', async () => {
    signIn([SCHOOL_A, SCHOOL_B])
    const { router } = await mountApp('/courses/c1/edit')

    expect(router.currentRoute.value.name).toBe('course-edit')

    useCurrentSchool().select(SCHOOL_B)
    await flushPromises()

    // The course belonged to the school being left, so the screen showing it
    // cannot stay open; its section's index is where the work continues. The
    // wait is for the index screen's own module to load, not for the decision.
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('courses'), {
      timeout: 20_000,
    })

    // Loading two whole sections through their lazy routes takes longer than
    // the default allowance, and that is compilation rather than the test.
  }, 30_000)

  it('stays on a list when the school changes, because a list reloads itself', async () => {
    signIn([SCHOOL_A, SCHOOL_B])
    const { router } = await mountApp('/groups')

    useCurrentSchool().select(SCHOOL_B)
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('groups')
  }, 30_000)

  it('shows the not-found screen for an address no section owns', async () => {
    signIn()
    const { app, router } = await mountApp('/nothing/here')

    expect(router.currentRoute.value.name).toBe('not-found')
    expect(app.text()).toContain('Страница не найдена')
  })
})
