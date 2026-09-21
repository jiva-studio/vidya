import type { PermissionKey } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setAppRouter } from '@/shared/access'
import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, mountWithApp } from '@/shared/testing'

import { messages } from '../i18n'
import EnrollmentsPage from '../ui/EnrollmentsPage.vue'

const ENROLLMENTS = '/edu/enrollments'
const COURSES = '/edu/courses'
const GROUPS = '/edu/groups'

const blank = { template: '<div />' }

const signIn = (permissions: PermissionKey[]) => {
  const claims = {
    sub: 'u9',
    exp: 2_000_000_000,
    permissions: [{ sid: 'school-1', p: permissions }],
  }
  useSession().start({ accessToken: `h.${btoa(JSON.stringify(claims))}.s`, refreshToken: 'r' })
}

const summary = (id: string, createdAt: string, over: Record<string, unknown> = {}) => ({
  id,
  courseId: 'c1',
  status: 'declined',
  createdAt,
  ...over,
})

const details = (id: string, studentId: string, over: Record<string, unknown> = {}) => ({
  id,
  courseId: 'c1',
  studentId,
  schoolId: 'school-1',
  status: 'declined',
  createdAt: '2024-02-01T10:00:00.000Z',
  ...over,
})

const person = (id: string, name: string) => ({ id, name, email: `${id}@example.com`, roles: [] })

// Anna asked twice, two years apart, and Boris once in between. The server
// answers in its own order, which is not the order a history is read in.
const world = (): FakeAnswers => ({
  [COURSES]: { items: [{ id: 'c1', name: 'Foundations' }] },
  [GROUPS]: { items: [{ id: 'g1', name: 'Morning', status: 'pending' }] },
  [ENROLLMENTS]: {
    items: [
      summary('anna-first', '2024-02-01T10:00:00.000Z'),
      summary('boris', '2025-01-01T10:00:00.000Z'),
      summary('anna-again', '2026-03-01T10:00:00.000Z', { status: 'pending' }),
    ],
  },
  [`${ENROLLMENTS}/anna-first`]: details('anna-first', 'u1'),
  [`${ENROLLMENTS}/boris`]: details('boris', 'u2'),
  [`${ENROLLMENTS}/anna-again`]: details('anna-again', 'u1', {
    status: 'pending',
    createdAt: '2026-03-01T10:00:00.000Z',
  }),
  '/edu/users/u1': person('u1', 'Ann Ivanova'),
  '/edu/users/u2': person('u2', 'Boris Petrov'),
})

const mountPage = async (answers: FakeAnswers) => {
  const transport = fakeHttpClient(answers)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/s/:schoolId/enrollments', name: 'enrollments', component: blank }],
  })
  setAppRouter(router)
  await router.push('/s/school-1/enrollments')
  await router.isReady()

  const page = mountWithApp(EnrollmentsPage, {
    global: { plugins: [router], provide: { [httpClientKey as symbol]: transport.client } },
  })

  await flushPromises()
  return { transport, page }
}

/**
 * A student may ask for the same course again, so the same name on two lines is
 * a history and not a list printed twice. It reads as one when the attempts sit
 * together, newest first, each with the date it was made.
 */
describe('several attempts of one student on one course', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    document.body.innerHTML = ''
    addMessages(messages)
    signIn(['enrollments:read', 'enrollments:moderate', 'users:read'] as PermissionKey[])
  })

  it('keeps them together and puts the latest first', async () => {
    const { page } = await mountPage(world())

    const rows = page.findAll('tbody tr').map((row) => row.text())

    expect(rows).toHaveLength(3)
    expect(rows[0]).toContain('Ann Ivanova')
    expect(rows[0]).toContain('2026')
    expect(rows[1]).toContain('Ann Ivanova')
    expect(rows[1]).toContain('2024')
    expect(rows[2]).toContain('Boris Petrov')
  })
})
