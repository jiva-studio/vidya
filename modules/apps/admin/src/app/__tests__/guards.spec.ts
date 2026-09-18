import type { PermissionKey, SchoolId } from '@vidya/domain'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type Router, type RouteRecordRaw } from 'vue-router'

import { useCurrentSchool } from '@/shared/access'
import { useSession } from '@/shared/session'

import { requireSession, skipLoginWhenSignedIn } from '../router/guards'
import { sectionRoutes } from '../sections'

const school = (value: string) => value as unknown as SchoolId

const SCHOOL_A = school('11111111-1111-1111-1111-111111111111')

const blank = { template: '<div />' }

const token = (permissions: unknown) =>
  `header.${btoa(JSON.stringify({ sub: 'u1', exp: 2_000_000_000, permissions }))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')}.sig`

const signIn = (permissions: unknown = [{ sid: SCHOOL_A, p: ['*'] }]) =>
  useSession().start({ accessToken: token(permissions), refreshToken: 'refresh' })

const routerWith = (extra: RouteRecordRaw[] = []): Router => {
  const routes: RouteRecordRaw[] = sectionRoutes().map(
    (route) => ({ ...route, component: blank }) as RouteRecordRaw,
  )
  const router = createRouter({ history: createMemoryHistory(), routes: [...extra, ...routes] })
  router.beforeEach(skipLoginWhenSignedIn)
  router.beforeEach(requireSession)
  return router
}

describe('router guards', () => {
  beforeEach(() => {
    localStorage.clear()
    useSession().end()
    useCurrentSchool().select(SCHOOL_A)
  })

  it('sends a visitor without a session to sign in', async () => {
    const router = routerWith()

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('login')
  })

  it('remembers the address the visitor was thrown out of', async () => {
    const router = routerWith([{ path: '/deep/screen', name: 'deep', component: blank }])

    await router.push('/deep/screen?filter=open')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/deep/screen?filter=open')
  })

  it('carries no redirect for the root, which is where sign-in already lands', async () => {
    const router = routerWith()

    await router.push('/')

    expect(router.currentRoute.value.query.redirect).toBeUndefined()
  })

  it('lets a signed-in operator through', async () => {
    const router = routerWith()
    signIn()

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('dashboard')
  })

  it('keeps a signed-in operator off the sign-in screen', async () => {
    const router = routerWith()
    signIn()

    await router.push('/login')

    expect(router.currentRoute.value.name).toBe('dashboard')
  })

  it('refuses a screen the current school does not grant', async () => {
    const router = routerWith([
      {
        path: '/homework',
        name: 'homework-queue-test',
        component: blank,
        meta: { permission: 'homework:grade' as PermissionKey },
      },
    ])
    signIn([{ sid: SCHOOL_A, p: ['courses:read'] }])

    await router.push('/homework')

    expect(router.currentRoute.value.name).toBe('forbidden')
  })

  it('allows a screen the current school does grant', async () => {
    const router = routerWith([
      {
        path: '/homework',
        name: 'homework-queue-test',
        component: blank,
        meta: { permission: 'homework:grade' as PermissionKey },
      },
    ])
    signIn([{ sid: SCHOOL_A, p: ['homework:grade'] }])

    await router.push('/homework')

    expect(router.currentRoute.value.name).toBe('homework-queue-test')
  })

  it('shows the not-found screen for an unknown address without signing in first', async () => {
    const router = routerWith()

    await router.push('/nothing/here')

    expect(router.currentRoute.value.name).toBe('not-found')
  })
})

describe('route table', () => {
  it('registers the catch-all last, so no section is shadowed by it', () => {
    const routes = sectionRoutes()
    const names = routes.map((route) => route.name)

    expect(names.at(-1)).toBe('not-found')
    expect(names.at(-2)).toBe('forbidden')
  })

  it('names every route, because the sidebar navigates by name', () => {
    expect(sectionRoutes().every((route) => route.name !== undefined)).toBe(true)
  })

  it('loads every screen lazily', () => {
    expect(sectionRoutes().every((route) => typeof route.component === 'function')).toBe(true)
  })

  it('leaves only sign-in and not-found reachable without a session', () => {
    const open = sectionRoutes()
      .filter((route) => route.meta?.public)
      .map((route) => route.name)

    expect(open).toEqual(['login', 'not-found'])
  })
})
