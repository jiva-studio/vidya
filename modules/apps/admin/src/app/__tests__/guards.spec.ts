import type { PermissionKey, SchoolId } from '@vidya/domain'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type Router, type RouteRecordRaw } from 'vue-router'

import { setAppRouter } from '@/shared/access'
import { useSession } from '@/shared/session'

import { requireSession, resolveSchool, skipLoginWhenSignedIn } from '../router/guards'
import { sectionRoutes } from '../sections'

const school = (value: string) => value as unknown as SchoolId

const SCHOOL_A = school('11111111-1111-1111-1111-111111111111')
const SCHOOL_B = school('22222222-2222-2222-2222-222222222222')
const UNKNOWN = school('99999999-9999-9999-9999-999999999999')

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
  setAppRouter(router)
  router.beforeEach(skipLoginWhenSignedIn)
  router.beforeEach(requireSession)
  router.beforeEach(resolveSchool(router))
  return router
}

describe('router guards', () => {
  beforeEach(() => {
    localStorage.clear()
    useSession().end()
    setAppRouter(undefined)
  })

  it('sends a visitor without a session to sign in', async () => {
    const router = routerWith()

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('login')
  })

  it('remembers the address the visitor was thrown out of, school and all', async () => {
    const router = routerWith()

    await router.push(`/s/${SCHOOL_A}/roles?filter=open`)

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe(`/s/${SCHOOL_A}/roles?filter=open`)
  })

  it('carries no redirect for the root, which is where sign-in already lands', async () => {
    const router = routerWith()

    await router.push('/')

    expect(router.currentRoute.value.query.redirect).toBeUndefined()
  })

  it('lands a signed-in operator on the first granted school, from an address with none', async () => {
    const router = routerWith()
    signIn([
      { sid: SCHOOL_A, p: ['*'] },
      { sid: SCHOOL_B, p: ['*'] },
    ])

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('dashboard')
    expect(router.currentRoute.value.fullPath).toBe(`/s/${SCHOOL_A}`)
  })

  it('keeps a screen asked for without a school, under the first granted one', async () => {
    const router = routerWith()
    signIn()

    await router.push('/roles?filter=open')

    expect(router.currentRoute.value.name).toBe('roles')
    expect(router.currentRoute.value.fullPath).toBe(`/s/${SCHOOL_A}/roles?filter=open`)
  })

  it('sends an unknown school to the first granted one, staying on the screen', async () => {
    const router = routerWith()
    signIn()

    await router.push(`/s/${UNKNOWN}/roles`)

    expect(router.currentRoute.value.fullPath).toBe(`/s/${SCHOOL_A}/roles`)
  })

  it('sends a school the token does not grant to the first granted one', async () => {
    const router = routerWith()
    signIn([{ sid: SCHOOL_B, p: ['*'] }])

    await router.push(`/s/${SCHOOL_A}/roles`)

    expect(router.currentRoute.value.fullPath).toBe(`/s/${SCHOOL_B}/roles`)
  })

  it('leaves an address the token does grant alone', async () => {
    const router = routerWith()
    signIn([
      { sid: SCHOOL_A, p: ['*'] },
      { sid: SCHOOL_B, p: ['*'] },
    ])

    await router.push(`/s/${SCHOOL_B}/roles`)

    expect(router.currentRoute.value.fullPath).toBe(`/s/${SCHOOL_B}/roles`)
  })

  it('refuses a token that grants nothing, rather than looking for a school to use', async () => {
    const router = routerWith()
    signIn([])

    await router.push(`/s/${SCHOOL_A}/roles`)

    expect(router.currentRoute.value.name).toBe('forbidden')
  })

  it('leaves the refusal screen reachable for a token that grants nothing', async () => {
    const router = routerWith()
    signIn([])

    await router.push('/')
    const first = router.currentRoute.value.fullPath

    await router.push('/forbidden')

    expect(first).toBe('/forbidden')
    expect(router.currentRoute.value.fullPath).toBe('/forbidden')
  })

  it('keeps a signed-in operator off the sign-in screen', async () => {
    const router = routerWith()
    signIn()

    await router.push('/login')

    expect(router.currentRoute.value.name).toBe('dashboard')
  })

  it('refuses a screen the school does not grant', async () => {
    const router = routerWith([
      {
        path: '/s/:schoolId/grading',
        name: 'grading-test',
        component: blank,
        meta: { permission: 'homework:grade' as PermissionKey },
      },
    ])
    signIn([{ sid: SCHOOL_A, p: ['courses:read'] }])

    await router.push(`/s/${SCHOOL_A}/grading`)

    expect(router.currentRoute.value.name).toBe('forbidden')
  })

  it('allows a screen the school does grant', async () => {
    const router = routerWith([
      {
        path: '/s/:schoolId/grading',
        name: 'grading-test',
        component: blank,
        meta: { permission: 'homework:grade' as PermissionKey },
      },
    ])
    signIn([{ sid: SCHOOL_A, p: ['homework:grade'] }])

    await router.push(`/s/${SCHOOL_A}/grading`)

    expect(router.currentRoute.value.name).toBe('grading-test')
  })

  it('judges the permission by the school the address is being corrected to', async () => {
    const router = routerWith([
      {
        path: '/s/:schoolId/grading',
        name: 'grading-test',
        component: blank,
        meta: { permission: 'homework:grade' as PermissionKey },
      },
    ])
    signIn([{ sid: SCHOOL_B, p: ['homework:grade'] }])

    await router.push(`/s/${SCHOOL_A}/grading`)

    expect(router.currentRoute.value.fullPath).toBe(`/s/${SCHOOL_B}/grading`)
  })

  it('shows the not-found screen for an unknown address without signing in first', async () => {
    const router = routerWith()

    await router.push('/nothing/here')

    expect(router.currentRoute.value.name).toBe('not-found')
  })

  it('shows the not-found screen for an unknown address no school would own', async () => {
    const router = routerWith()
    signIn()

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

  it('addresses every section screen under a school', () => {
    const schoolLess = sectionRoutes()
      .filter((route) => !route.path.startsWith('/s/:schoolId'))
      .map((route) => route.name)

    expect(schoolLess).toEqual(['login', 'root', 'forbidden', 'not-found'])
  })
})
