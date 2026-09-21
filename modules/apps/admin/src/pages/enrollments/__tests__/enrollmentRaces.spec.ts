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

addMessages(messages)

const ENROLLMENTS = '/edu/enrollments'
const COURSES = '/edu/courses'
const GROUPS = '/edu/groups'
const MODERATE = `${ENROLLMENTS}/e1/moderation`

const blank = { template: '<div />' }

/** A promise the test settles by hand, to hold a request in flight. */
const deferred = <T>() => {
  let settle!: (value: T) => void
  const promise = new Promise<T>((resolve) => {
    settle = resolve
  })

  return { promise, settle }
}

const signIn = (permissions: PermissionKey[]) => {
  const claims = {
    sub: 'u9',
    exp: 2_000_000_000,
    permissions: [{ sid: 'school-1', p: permissions }],
  }
  useSession().start({ accessToken: `h.${btoa(JSON.stringify(claims))}.s`, refreshToken: 'r' })
}

const summary = {
  id: 'e1',
  courseId: 'c1',
  status: 'pending',
  createdAt: '2026-09-01T10:00:00.000Z',
}

const world = (over: FakeAnswers = {}): FakeAnswers => ({
  [COURSES]: { items: [{ id: 'c1', name: 'Основы' }] },
  [GROUPS]: { items: [] },
  [ENROLLMENTS]: { items: [summary] },
  [`${ENROLLMENTS}/e1`]: { ...summary, studentId: 'u1', schoolId: 'school-1' },
  '/edu/users/u1': { id: 'u1', name: 'Аня Иванова', email: 'a@example.org', roles: [] },
  ...over,
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

const nameOf = (node: Element) => node.getAttribute('aria-label') ?? node.textContent ?? ''

const buttonLabelled = (page: { element: Element }, label: string): HTMLElement => {
  const button = [...page.element.querySelectorAll<HTMLElement>('button')].find(
    (node) => nameOf(node).trim() === label,
  )
  if (!button) throw new Error(`no button labelled "${label}"`)
  return button
}

describe('deciding a request twice before the first answer', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
  })

  // The button's own busy flag reaches the DOM a render late, so the guard
  // that holds here is the synchronous one in the composable.
  it('sends one decision however fast the row is clicked', async () => {
    signIn(['enrollments:read', 'enrollments:moderate', 'courses:read', 'groups:read'])

    const decision = deferred<unknown>()

    const { transport, page } = await mountPage(
      world({ [`PATCH ${MODERATE}`]: () => decision.promise }),
    )

    const accept = buttonLabelled(page, 'Принять')
    accept.click()
    accept.click()
    accept.click()
    await flushPromises()

    expect(transport.callsTo(MODERATE)).toHaveLength(1)

    decision.settle({ ...summary, status: 'accepted' })
    await flushPromises()

    expect(transport.callsTo(MODERATE)).toHaveLength(1)
  })
})
