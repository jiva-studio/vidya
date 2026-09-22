import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setAppRouter } from '@/shared/access'
import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages, translate } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, mountWithApp, pending, refusal } from '@/shared/testing'

import { messages } from '../i18n'
import EnrollmentsPage from '../ui/EnrollmentsPage.vue'

const ENROLLMENTS = '/edu/enrollments'
const COURSES = '/edu/courses'
const GROUPS = '/edu/groups'

// Read when a test asks, not when the file loads: the copy is registered in
// `beforeEach`, and a name taken before that would be the key itself.
const REVIEW = () => translate('enrollments-review')
const ACCEPT = () => translate('enrollments-review-accept')
const ARCHIVE = () => translate('enrollments-archive')

const blank = { template: '<div />' }

const signIn = () => {
  const claims = {
    sub: 'u9',
    exp: 2_000_000_000,
    permissions: [
      { sid: 'school-1', p: ['enrollments:read', 'enrollments:moderate', 'users:read'] },
    ],
  }
  useSession().start({ accessToken: `h.${btoa(JSON.stringify(claims))}.s`, refreshToken: 'r' })
}

const summary = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  courseId: 'c1',
  status: 'pending',
  createdAt: '2026-09-01T10:00:00.000Z',
  ...over,
})

const details = (over: Record<string, unknown> = {}) => ({
  ...summary(over),
  studentId: 'u1',
  schoolId: 'school-1',
  ...over,
})

const world = (over: FakeAnswers = {}): FakeAnswers => ({
  [COURSES]: { items: [{ id: 'c1', name: 'Foundations' }] },
  [GROUPS]: { items: [{ id: 'g1', name: 'Morning', status: 'pending' }] },
  [ENROLLMENTS]: { items: [summary()] },
  [`${ENROLLMENTS}/e1`]: details(),
  '/edu/users/u1': { id: 'u1', name: 'Ann Ivanova', email: 'a@example.com', roles: [] },
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

const click = async (page: Page, label: string) => {
  const button = page.findAll('button').find((candidate) => nameOf(candidate) === label)
  await button?.trigger('click')
  await flushPromises()
}

const inBody = (label: string) =>
  [...document.body.querySelectorAll('button')].find(
    (candidate) =>
      (candidate.getAttribute('aria-label') ?? candidate.textContent)?.trim() === label,
  )

const clickInBody = async (label: string) => {
  inBody(label)?.click()
  await flushPromises()
}

/** Everything on screen: the table, and whatever an overlay put beside it. */
const shown = (page: Page) => `${page.text()} ${document.body.textContent ?? ''}`

/**
 * A decision the server refuses has to land where it was made.
 *
 * Every one of these moves reaches a server that may say no — a place that has
 * since been filled, a right the operator turns out not to have — and a console
 * that answers no with an unchanged row leaves the operator clicking again.
 */
describe('a decision the server refuses', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    document.body.innerHTML = ''
    addMessages(messages)
    signIn()
  })

  it('keeps the review open while the server is deciding, and says it is working', async () => {
    const { page } = await mountPage(
      world({ [`PATCH ${ENROLLMENTS}/e1/moderation`]: () => pending() }),
    )

    await click(page, REVIEW())
    await clickInBody(ACCEPT())

    expect(inBody(ACCEPT())).toBeDefined()
    expect(inBody(ACCEPT())?.getAttribute('aria-busy')).toBe('true')
  })

  it('keeps the review open on a refusal and names the reason the server gave', async () => {
    const { page } = await mountPage(
      world({
        [`PATCH ${ENROLLMENTS}/e1/moderation`]: refusal(409, 'The group is already full'),
      }),
    )

    await click(page, REVIEW())
    await clickInBody(ACCEPT())

    expect(inBody(ACCEPT())).toBeDefined()
    expect(shown(page)).toContain('The group is already full')
  })

  it('closes the review once the server has taken the decision', async () => {
    const { page } = await mountPage(
      world({ [`PATCH ${ENROLLMENTS}/e1/moderation`]: details({ status: 'accepted' }) }),
    )

    await click(page, REVIEW())
    expect(inBody(ACCEPT())).toBeDefined()

    await clickInBody(ACCEPT())

    expect(inBody(ACCEPT())).toBeUndefined()
  })

  it('says on the row itself why the school could not put it away', async () => {
    const { page } = await mountPage(
      world({
        [ENROLLMENTS]: { items: [summary({ status: 'declined' })] },
        [`${ENROLLMENTS}/e1`]: details({ status: 'declined' }),
        [`PATCH ${ENROLLMENTS}/e1/archive`]: refusal(409, 'The request still holds a place'),
      }),
    )

    await click(page, ARCHIVE())
    await clickInBody(ARCHIVE())

    expect(page.text()).toContain('The request still holds a place')
  })

  it('turns a refusal without a sentence of its own into one an operator can read', async () => {
    const { page } = await mountPage(
      world({
        [ENROLLMENTS]: { items: [summary({ status: 'declined' })] },
        [`${ENROLLMENTS}/e1`]: details({ status: 'declined' }),
        [`PATCH ${ENROLLMENTS}/e1/archive`]: refusal(403, ''),
      }),
    )

    await click(page, ARCHIVE())
    await clickInBody(ARCHIVE())

    expect(page.text()).toContain(translate('page-forbidden-title'))
    expect(page.text()).not.toContain('error-forbidden')
  })

  it('shows the row is being put away while the server has not answered', async () => {
    const { page } = await mountPage(
      world({
        [ENROLLMENTS]: { items: [summary({ status: 'declined' })] },
        [`${ENROLLMENTS}/e1`]: details({ status: 'declined' }),
        [`PATCH ${ENROLLMENTS}/e1/archive`]: () => pending(),
      }),
    )

    await click(page, ARCHIVE())
    await clickInBody(ARCHIVE())

    const button = page.findAll('button').find((candidate) => nameOf(candidate) === ARCHIVE())

    expect(button?.attributes('aria-busy')).toBe('true')
  })

  it('leaves no reason from a refused decision on the next request reviewed', async () => {
    const { page } = await mountPage(
      world({
        [`PATCH ${ENROLLMENTS}/e1/moderation`]: refusal(409, 'The group is already full'),
      }),
    )

    await click(page, REVIEW())
    await clickInBody(ACCEPT())
    await clickInBody(translate('action-close'))
    await click(page, REVIEW())

    expect(shown(page)).not.toContain('The group is already full')
  })
})
