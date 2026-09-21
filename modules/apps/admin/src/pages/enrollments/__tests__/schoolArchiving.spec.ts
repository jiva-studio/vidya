import type { PermissionKey } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setAppRouter } from '@/shared/access'
import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages, translate } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import type { FakeAnswers, RecordedCall } from '@/shared/testing'
import { fakeHttpClient, mountWithApp } from '@/shared/testing'

import { messages } from '../i18n'
import EnrollmentsPage from '../ui/EnrollmentsPage.vue'

const ENROLLMENTS = '/edu/enrollments'
const COURSES = '/edu/courses'
const GROUPS = '/edu/groups'

const copy = `
enrollments-archive = Put away
enrollments-review = Review
`

const blank = { template: '<div />' }

const signIn = (permissions: PermissionKey[]) => {
  const claims = {
    sub: 'u9',
    exp: 2_000_000_000,
    permissions: [{ sid: 'school-1', p: permissions }],
  }
  useSession().start({ accessToken: `h.${btoa(JSON.stringify(claims))}.s`, refreshToken: 'r' })
}

const WHEN_THE_SCHOOL_TIDIED_UP = '2026-09-10T08:00:00.000Z'
const WHEN_THE_STUDENT_TIDIED_UP = '2026-09-11T08:00:00.000Z'

const summary = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  courseId: 'c1',
  status: 'declined',
  createdAt: '2026-09-01T10:00:00.000Z',
  ...over,
})

/**
 * The details as the console reads them back.
 *
 * A stamp the server holds as `null` reaches here as no field at all, so a
 * fixture that wants "nobody tidied this up" leaves the key out.
 */
const details = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  courseId: 'c1',
  studentId: 'u1',
  schoolId: 'school-1',
  status: 'declined',
  createdAt: '2026-09-01T10:00:00.000Z',
  ...over,
})

const person = { id: 'u1', name: 'Ann Ivanova', email: 'a@example.com', roles: [] }

const world = (over: FakeAnswers = {}): FakeAnswers => ({
  [COURSES]: { items: [{ id: 'c1', name: 'Foundations' }] },
  [GROUPS]: { items: [{ id: 'g1', name: 'Morning', status: 'pending' }] },
  [ENROLLMENTS]: { items: [summary('e1')] },
  [`${ENROLLMENTS}/e1`]: details('e1'),
  '/edu/users/u1': person,
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

type Page = Awaited<ReturnType<typeof mountPage>>['page']

const nameOf = (button: { text: () => string; attributes: (name: string) => string | undefined }) =>
  button.attributes('aria-label') ?? button.text()

const labels = (page: Page) => page.findAll('button').map(nameOf)

const click = async (page: Page, label: string) => {
  const button = page.findAll('button').find((candidate) => nameOf(candidate) === label)
  await button?.trigger('click')
  await flushPromises()
}

const confirmInBody = async (label: string) => {
  const button = [...document.body.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label,
  )
  button?.click()
  await flushPromises()
}

/**
 * Each side keeps its own list, and tidying one leaves the other untouched: the
 * row the school is done with is still the student's answer to where their
 * course went.
 */
describe('the school putting a row out of its own sight', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    document.body.innerHTML = ''
    addMessages(messages)
    addMessages({ en: copy, ru: copy })
    signIn(['enrollments:read', 'enrollments:moderate', 'users:read'] as PermissionKey[])
  })

  it('asks the school route to do it, and sends nothing that belongs to the student', async () => {
    let tidied = false
    const { transport, page } = await mountPage(
      world({
        [ENROLLMENTS]: () => ({ items: tidied ? [] : [summary('e1')] }),
        [`PATCH ${ENROLLMENTS}/e1/archive`]: () => {
          tidied = true
          return details('e1', { archivedBySchoolAt: WHEN_THE_SCHOOL_TIDIED_UP })
        },
      }),
    )

    await click(page, translate('enrollments-archive'))
    await confirmInBody(translate('enrollments-archive'))

    const written = transport.calls.filter((call: RecordedCall) => call.method === 'PATCH')
    expect(written).toHaveLength(1)
    expect(written[0]).toMatchObject({ path: `${ENROLLMENTS}/e1/archive` })
    expect(written[0]?.body).toBeUndefined()
    expect(page.text()).not.toContain('Ann Ivanova')
  })

  it('offers it only once the request has been answered', async () => {
    const { page } = await mountPage(
      world({
        [ENROLLMENTS]: { items: [summary('e1', { status: 'pending' })] },
        [`${ENROLLMENTS}/e1`]: details('e1', { status: 'pending' }),
      }),
    )

    expect(labels(page)).not.toContain(translate('enrollments-archive'))

    const { page: answered } = await mountPage(world())

    expect(labels(answered)).toContain(translate('enrollments-archive'))
  })

  it('is offered to nobody without the right to moderate', async () => {
    const { page: allowed } = await mountPage(world())

    expect(labels(allowed)).toEqual(
      expect.arrayContaining([translate('enrollments-archive'), translate('enrollments-review')]),
    )

    useSession().end()
    signIn(['enrollments:read', 'users:read'] as PermissionKey[])
    const { page: reader } = await mountPage(world())

    expect(labels(reader)).not.toContain(translate('enrollments-archive'))
    expect(labels(reader)).not.toContain(translate('enrollments-review'))
  })

  it('drops what the school put away and keeps what the student did', async () => {
    const { page } = await mountPage(
      world({
        [ENROLLMENTS]: { items: [summary('e1'), summary('e2'), summary('e3')] },
        [`${ENROLLMENTS}/e1`]: details('e1', {
          archivedBySchoolAt: WHEN_THE_SCHOOL_TIDIED_UP,
          archivedBySchoolById: 'u9',
        }),
        [`${ENROLLMENTS}/e2`]: details('e2', {
          studentId: 'u2',
          archivedByStudentAt: WHEN_THE_STUDENT_TIDIED_UP,
        }),
        [`${ENROLLMENTS}/e3`]: details('e3', { studentId: 'u3' }),
        '/edu/users/u2': { ...person, id: 'u2', name: 'Boris Petrov' },
        '/edu/users/u3': { ...person, id: 'u3', name: 'Vera Sidorova' },
      }),
    )

    expect(page.text()).not.toContain('Ann Ivanova')
    expect(page.text()).toContain('Boris Petrov')
    expect(page.text()).toContain('Vera Sidorova')
  })
})
