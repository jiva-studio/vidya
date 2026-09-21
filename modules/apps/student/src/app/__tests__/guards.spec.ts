import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'

import { useConnection } from '@/shared/connection'

import { requireSchoolCode, requireSession, skipLoginWhenSignedIn } from '../router/guards'
import { sectionRoutes } from '../sections'

const routerFor = () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: sectionRoutes() as RouteRecordRaw[],
  })

  router.beforeEach(skipLoginWhenSignedIn)
  router.beforeEach(requireSchoolCode)
  router.beforeEach(requireSession)

  return router
}

const signIn = () => {
  const connection = useConnection()
  connection.offer({ accessToken: 'access', refreshToken: 'refresh' })
  connection.signIn('u1' as never)
}

describe('who is let where', () => {
  beforeEach(() => {
    localStorage.clear()
    useConnection().signOut()
  })

  afterEach(() => {
    useConnection().signOut()
  })

  it('sends a visitor with no session to sign in, carrying where they were going', async () => {
    const router = routerFor()

    await router.push('/s/AB3K7Q')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/s/AB3K7Q')
  })

  it('asks nothing of the joining link: it is read before there is an account', async () => {
    const router = routerFor()

    await router.push('/j/AB3K7Q')

    expect(router.currentRoute.value.name).toBe('join')
  })

  it('lets a signed-in student reach their own screens', async () => {
    signIn()
    const router = routerFor()

    await router.push('/homework')

    expect(router.currentRoute.value.name).toBe('homework')
  })

  it('keeps a signed-in student off the sign-in screen', async () => {
    signIn()
    const router = routerFor()

    await router.push('/login')

    expect(router.currentRoute.value.name).toBe('learning')
  })

  it('refuses an identifier where a school code belongs', async () => {
    signIn()
    const router = routerFor()

    await router.push('/s/2a0e4f52-2f2e-4a2a-9f27-2b8f0f2f3a11')

    expect(router.currentRoute.value.name).toBe('not-found')
  })

  it('refuses an identifier in a joining link as well, before any request', async () => {
    const router = routerFor()

    await router.push('/j/2a0e4f52-2f2e-4a2a-9f27-2b8f0f2f3a11')

    expect(router.currentRoute.value.name).toBe('not-found')
  })

  it('opens a lesson of a school by its code', async () => {
    signIn()
    const router = routerFor()

    await router.push('/s/AB3K7Q/c/course-1/l/lesson-1')

    expect(router.currentRoute.value.name).toBe('lesson')
    expect(router.currentRoute.value.params).toMatchObject({
      code: 'AB3K7Q',
      courseId: 'course-1',
      lessonId: 'lesson-1',
    })
  })
})
