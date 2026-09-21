import type { PermissionKey } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setAppRouter } from '@/shared/access'
import { httpClientKey, resetApi } from '@/shared/api'
import { useSession } from '@/shared/session'
import type { RecordedCall } from '@/shared/testing'
import { fakeHttpClient, mountWithApp } from '@/shared/testing'

import DashboardPage from '../ui/DashboardPage.vue'

const ENROLLMENTS = '/edu/enrollments'
const HOMEWORK = '/edu/homework'

const blank = { template: '<div />' }

/** A promise the test settles by hand, to hold a request in flight. */
const deferred = <T>() => {
  let settle!: (value: T) => void
  const promise = new Promise<T>((resolve) => {
    settle = resolve
  })

  return { promise, settle }
}

const signIn = (schools: string[], permissions: PermissionKey[]) => {
  const claims = {
    sub: 'u1',
    exp: 2_000_000_000,
    permissions: schools.map((sid) => ({ sid, p: permissions })),
  }
  useSession().start({ accessToken: `h.${btoa(JSON.stringify(claims))}.s`, refreshToken: 'r' })
}

const rows = (howMany: number) => ({
  items: Array.from({ length: howMany }, (_, index) => ({ id: `row-${index}` })),
})

const schoolOf = (call: RecordedCall): string => String(call.query?.schoolId ?? '')

describe('the dashboard when the school changes before the counts arrive', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
  })

  it('shows the counts of the school on screen when the one left behind answers last', async () => {
    signIn(['school-1', 'school-2'], ['enrollments:read', 'homework:read'])

    const left = deferred<unknown>()

    const transport = fakeHttpClient({
      [ENROLLMENTS]: (call: RecordedCall) =>
        schoolOf(call) === 'school-1' ? left.promise : rows(2),
      [HOMEWORK]: (call: RecordedCall) => (schoolOf(call) === 'school-1' ? left.promise : rows(3)),
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/s/:schoolId', name: 'dashboard', component: blank },
        { path: '/s/:schoolId/enrollments', name: 'enrollments', component: blank },
        { path: '/s/:schoolId/homework', name: 'homework-queue', component: blank },
      ],
    })
    setAppRouter(router)
    await router.push('/s/school-1')
    await router.isReady()

    const page = mountWithApp(DashboardPage, {
      global: { plugins: [router], provide: { [httpClientKey as symbol]: transport.client } },
    })
    await flushPromises()

    await router.push('/s/school-2')
    await flushPromises()

    expect(transport.callsTo(ENROLLMENTS).map(schoolOf)).toEqual(['school-1', 'school-2'])

    left.settle(rows(99))
    await flushPromises()

    expect(page.text()).toContain('2')
    expect(page.text()).toContain('3')
    expect(page.text()).not.toContain('99')
    expect(page.findAll('[role="status"]')).toHaveLength(0)
  })
})
