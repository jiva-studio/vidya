import type { PermissionKey } from '@vidya/domain'
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
  ...over,
})

const world = (over: FakeAnswers = {}): FakeAnswers => ({
  [COURSES]: { items: [{ id: 'c1', name: 'Foundations' }] },
  [GROUPS]: { items: [{ id: 'g1', courseId: 'c1', name: 'Morning', status: 'pending' }] },
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

const nameOf = (button: { text: () => string; attributes: (name: string) => string | undefined }) =>
  button.attributes('aria-label') ?? button.text()

const click = async (page: Awaited<ReturnType<typeof mountPage>>['page'], label: string) => {
  const button = page.findAll('button').find((candidate) => nameOf(candidate) === label)
  expect(button, `no button labelled ${label}`).toBeDefined()
  await button?.trigger('click')
  await flushPromises()
}

const moderations = (transport: Awaited<ReturnType<typeof mountPage>>['transport']) =>
  transport.calls.filter((call) => call.path === `${ENROLLMENTS}/e1/moderation`)

describe('EnrollmentsPage: placement and expulsion', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    addMessages(messages)
    signIn(['enrollments:read', 'enrollments:moderate', 'courses:read', 'groups:read'])
  })

  it('opens on the requests still waiting rather than on every row ever written', async () => {
    const { transport } = await mountPage(world())

    const list = transport.calls.find((call) => call.path === ENROLLMENTS)

    expect(list?.query?.status).toBe('pending')
  })

  it('accepts into the group the student asked for', async () => {
    const { transport, page } = await mountPage(
      world({ [`${ENROLLMENTS}/e1`]: details({ preferredGroupId: 'g1' }) }),
    )

    await click(page, translate('enrollments-accept'))

    expect(moderations(transport)[0]?.body).toEqual({ status: 'accepted', groupId: 'g1' })
  })

  it('leaves the group out when the one that was asked for is gone', async () => {
    const { transport, page } = await mountPage(
      world({
        [GROUPS]: { items: [] },
        [`${ENROLLMENTS}/e1`]: details({ preferredGroupId: 'g-deleted' }),
      }),
    )

    await click(page, translate('enrollments-accept'))

    expect(moderations(transport)[0]?.body).toEqual({ status: 'accepted' })
  })

  it('leaves the group out when no group was asked for', async () => {
    const { transport, page } = await mountPage(world())

    await click(page, translate('enrollments-accept'))

    expect(moderations(transport)[0]?.body).toEqual({ status: 'accepted' })
  })

  it('takes an accepted place back once the expulsion is confirmed', async () => {
    const { transport, page } = await mountPage(
      world({
        [ENROLLMENTS]: { items: [summary({ status: 'accepted', groupId: 'g1' })] },
        [`${ENROLLMENTS}/e1`]: details({ status: 'accepted', groupId: 'g1' }),
      }),
    )

    await click(page, translate('enrollments-revoke'))
    expect(moderations(transport)).toHaveLength(0)
    expect(document.body.textContent).toContain(translate('enrollments-revoke-title'))

    const confirm = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === translate('enrollments-revoke'),
    )
    confirm?.click()
    await flushPromises()

    expect(moderations(transport)[0]?.body).toEqual({ status: 'revoked' })
  })

  it('offers no expulsion to somebody who cannot moderate', async () => {
    useSession().end()
    signIn(['enrollments:read', 'courses:read', 'groups:read'])

    const { page } = await mountPage(
      world({
        [ENROLLMENTS]: { items: [summary({ status: 'accepted', groupId: 'g1' })] },
        [`${ENROLLMENTS}/e1`]: details({ status: 'accepted', groupId: 'g1' }),
      }),
    )

    const labels = page.findAll('button').map(nameOf)

    expect(labels).not.toContain(translate('enrollments-revoke'))
  })

  it('says only when a decision was taken when it cannot say by whom', async () => {
    const { page } = await mountPage(
      world({
        [ENROLLMENTS]: { items: [summary({ status: 'accepted' })] },
        [`${ENROLLMENTS}/e1`]: details({
          status: 'accepted',
          decidedById: 'u-unreadable',
          decidedAt: '2026-09-02T10:00:00.000Z',
        }),
        '/edu/users/u-unreadable': { status: 403 },
      }),
    )

    expect(page.text()).not.toContain('—,')
  })
})
