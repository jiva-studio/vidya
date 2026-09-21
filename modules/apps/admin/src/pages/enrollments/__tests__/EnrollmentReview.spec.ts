import type { PermissionKey } from '@vidya/domain'
import type { SelectOption } from '@vidya/ui'
import { Select } from '@vidya/ui'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setAppRouter } from '@/shared/access'
import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages, translate } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, mountWithApp } from '@/shared/testing'

import { messages } from '../i18n'
import EnrollmentsFilters from '../ui/EnrollmentsFilters.vue'
import EnrollmentsPage from '../ui/EnrollmentsPage.vue'

const ENROLLMENTS = '/edu/enrollments'
const COURSES = '/edu/courses'
const GROUPS = '/edu/groups'

// Copy of this suite's own, so the screen owns its wording and the test owns
// only the keys it has to find a control by.
const copy = `
enrollments-review = Review
enrollments-review-group-closed = No longer taking students
enrollments-review-accept = Accept into the group
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

const EVENING_AT_SIX = {
  timeZone: 'Europe/Belgrade',
  ranges: [{ days: ['mon', 'wed'], startMinute: 1080, endMinute: 1200 }],
}

const summary = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  courseId: 'c1',
  status: 'pending',
  createdAt: '2026-09-01T10:00:00.000Z',
  ...over,
})

const details = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  courseId: 'c1',
  studentId: 'u1',
  schoolId: 'school-1',
  status: 'pending',
  createdAt: '2026-09-01T10:00:00.000Z',
  preferredGroupId: 'g1',
  preferredTimes: EVENING_AT_SIX,
  comment: 'Only after work',
  ...over,
})

const world = (over: FakeAnswers = {}): FakeAnswers => ({
  [COURSES]: { items: [{ id: 'c1', name: 'Foundations' }] },
  [GROUPS]: {
    items: [
      { id: 'g1', name: 'Morning', status: 'pending' },
      { id: 'g2', name: 'Evening', status: 'pending' },
    ],
  },
  [ENROLLMENTS]: { items: [summary()] },
  [`${ENROLLMENTS}/e1`]: details(),
  [`PATCH ${ENROLLMENTS}/e1/moderation`]: details({ status: 'accepted', groupId: 'g2' }),
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

const clickInBody = async (label: string) => {
  const button = [...document.body.querySelectorAll('button')].find(
    (candidate) =>
      (candidate.getAttribute('aria-label') ?? candidate.textContent)?.trim() === label,
  )
  button?.click()
  await flushPromises()
}

/** Everything on screen: the table, and whatever an overlay put beside it. */
const shown = (page: Page) => `${page.text()} ${document.body.textContent ?? ''}`

// The one the decision is made with, told apart from the three the table is
// narrowed by rather than by its position on the page.
const groupChoice = (page: Page) => {
  const narrowing = new Set(
    page
      .findComponent(EnrollmentsFilters)
      .findAllComponents(Select)
      .map((select) => select.element),
  )

  return page
    .findAllComponents(Select)
    .find(
      (select) =>
        !narrowing.has(select.element) &&
        (select.props('options') as SelectOption[]).some((option) => option.value === 'g2'),
    )
}

/**
 * A request is decided from what the student wrote, not from a row of ids.
 *
 * The screen carries three things the table has no room for — the group asked
 * for, when the student can attend, and what they said — and the decision that
 * answers them names the group in the same move.
 */
describe('reviewing a request', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    document.body.innerHTML = ''
    addMessages(messages)
    addMessages({ en: copy, ru: copy })
    signIn(['enrollments:read', 'enrollments:moderate', 'users:read'] as PermissionKey[])
  })

  it('names the group the student asked for, and keeps naming it while another is chosen', async () => {
    const { page } = await mountPage(world())

    expect(shown(page)).not.toContain('Morning')

    await click(page, translate('enrollments-review'))

    expect(shown(page)).toContain('Morning')

    groupChoice(page)?.vm.$emit('update:modelValue', 'g2')
    await flushPromises()

    expect(shown(page)).toContain('Morning')
  })

  it('says when that group has stopped taking anyone', async () => {
    const { page } = await mountPage(
      world({
        [GROUPS]: {
          items: [
            { id: 'g1', name: 'Morning', status: 'active' },
            { id: 'g2', name: 'Evening', status: 'pending' },
          ],
        },
      }),
    )

    await click(page, translate('enrollments-review'))

    expect(shown(page)).toContain(translate('enrollments-review-group-closed'))
  })

  it('leaves the hours as the student gave them and names the zone they are in', async () => {
    const { page } = await mountPage(world())

    await click(page, translate('enrollments-review'))

    expect(shown(page)).toContain('18:00')
    expect(shown(page)).toContain('20:00')
    expect(shown(page)).toContain('Europe/Belgrade')
  })

  it('shows what the student wrote', async () => {
    const { page } = await mountPage(world())

    await click(page, translate('enrollments-review'))

    expect(shown(page)).toContain('Only after work')
  })

  it('starts the decision from the group that was asked for', async () => {
    const { page } = await mountPage(world())

    await click(page, translate('enrollments-review'))

    expect(groupChoice(page)?.props('modelValue')).toBe('g1')
  })

  it('accepts the student into a group other than the one they asked for, in one move', async () => {
    const { transport, page } = await mountPage(world())

    await click(page, translate('enrollments-review'))
    groupChoice(page)?.vm.$emit('update:modelValue', 'g2')
    await flushPromises()
    await clickInBody(translate('enrollments-review-accept'))

    expect(transport.calls.find((call) => call.method === 'PATCH')).toMatchObject({
      path: `${ENROLLMENTS}/e1/moderation`,
      body: { status: 'accepted', groupId: 'g2' },
    })
    expect(transport.calls.filter((call) => call.path.endsWith('/group'))).toHaveLength(0)
  })
})
