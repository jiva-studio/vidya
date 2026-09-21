import type { SchoolId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages, locale, translate } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import { fakeHttpClient, mountWithApp, refusal } from '@/shared/testing'

import { messages } from '../i18n'
import GroupMembersPage from '../ui/GroupMembersPage.vue'

addMessages(messages)
locale.value = 'en'

const SCHOOL = asId<SchoolId>('11111111-1111-1111-1111-111111111111')
const GROUP = '44444444-4444-4444-4444-444444444444'

const ENROLLMENTS = '/edu/enrollments'
const USERS = '/edu/users'

const blank = { template: '<div />' }

const token = (permissions: unknown) =>
  `header.${btoa(JSON.stringify({ sub: 'u1', exp: 2_000_000_000, permissions }))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')}.sig`

const signIn = (rights: string[] = ['*']) =>
  useSession().start({
    accessToken: token([{ sid: SCHOOL, p: rights }]),
    refreshToken: 'refresh',
  })

const enrollment = (id: string, studentId: string, over: Record<string, unknown> = {}) => ({
  id,
  courseId: 'c1',
  groupId: GROUP,
  studentId,
  schoolId: SCHOOL,
  status: 'accepted',
  createdAt: '2026-02-01T10:00:00.000Z',
  ...over,
})

const open = async (answers: Record<string, unknown>) => {
  const routes = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/groups', name: 'groups', component: blank },
      { path: '/groups/:groupId/members', name: 'group-members', component: blank },
    ],
  })

  await routes.push(`/groups/${GROUP}/members`)
  await routes.isReady()

  const transport = fakeHttpClient(answers)
  const page = mountWithApp(GroupMembersPage, {
    global: { plugins: [routes], provide: { [httpClientKey as symbol]: transport.client } },
  })
  await flushPromises()

  return { transport, page }
}

const nameOf = (button: { text: () => string; attributes: (name: string) => string | undefined }) =>
  button.attributes('aria-label') ?? button.text()

const click = async (page: Awaited<ReturnType<typeof open>>['page'], label: string) => {
  const button = page.findAll('button').find((candidate) => nameOf(candidate) === label)
  expect(button, `no button labelled ${label}`).toBeDefined()
  await button?.trigger('click')
  await flushPromises()
}

describe('the roster of a group', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    signIn()
  })

  it('names a student the school list leaves out rather than printing their id', async () => {
    // Enrolment is a place on a course, not a role, so an accepted student need
    // not appear in `GET /edu/users` at all. That is the row that showed a UUID.
    const { page } = await open({
      [`${ENROLLMENTS}/e1`]: enrollment('e1', 'u-roleless'),
      [ENROLLMENTS]: { items: [{ id: 'e1' }] },
      [USERS]: { items: [] },
      [`${USERS}/u-roleless`]: { id: 'u-roleless', name: 'Nitai Das' },
    })

    expect(page.text()).toContain('Nitai Das')
    expect(page.text()).not.toContain('u-roleless')
  })

  it('asks for nobody the school list already named', async () => {
    const { transport } = await open({
      [`${ENROLLMENTS}/e1`]: enrollment('e1', 'u1'),
      [ENROLLMENTS]: { items: [{ id: 'e1' }] },
      [USERS]: { items: [{ id: 'u1', name: 'Anna' }] },
    })

    expect(transport.callsTo(`${USERS}/u1`)).toHaveLength(0)
  })

  it('takes the place back when an expulsion is confirmed', async () => {
    const { transport, page } = await open({
      [`${ENROLLMENTS}/e1`]: enrollment('e1', 'u1'),
      [ENROLLMENTS]: { items: [{ id: 'e1' }] },
      [USERS]: { items: [{ id: 'u1', name: 'Anna' }] },
    })

    await click(page, translate('group-members-revoke'))

    const confirm = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === translate('group-members-revoke'),
    )
    confirm?.click()
    await flushPromises()

    expect(transport.callsTo(`${ENROLLMENTS}/e1/moderation`)[0]).toMatchObject({
      body: { status: 'revoked' },
    })
  })

  // The decision nulls the group, and the roster is read by group, so a row
  // that ended is not here to put back. Requests is where those rows are.
  it('asks for nobody the school list could not name either', async () => {
    const { transport } = await open({
      [`${ENROLLMENTS}/e1`]: enrollment('e1', 'u1'),
      [ENROLLMENTS]: { items: [{ id: 'e1' }] },
      [USERS]: refusal(403, 'Forbidden'),
    })

    expect(transport.callsTo(`${USERS}/u1`)).toHaveLength(0)
  })

  it('says why an expulsion did not happen', async () => {
    const { page } = await open({
      [`${ENROLLMENTS}/e1`]: enrollment('e1', 'u1'),
      [ENROLLMENTS]: { items: [{ id: 'e1' }] },
      [USERS]: { items: [{ id: 'u1', name: 'Anna' }] },
      [`${ENROLLMENTS}/e1/moderation`]: refusal(409, 'Too late'),
    })

    await click(page, translate('group-members-revoke'))
    const confirm = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === translate('group-members-revoke'),
    )
    confirm?.click()
    await flushPromises()

    expect(page.find('[role="alert"]').exists()).toBe(true)
  })

  it('offers no levers to somebody who may not moderate', async () => {
    useSession().end()
    signIn(['groups:read', 'enrollments:read', 'users:read'])

    const { page } = await open({
      [`${ENROLLMENTS}/e1`]: enrollment('e1', 'u1'),
      [ENROLLMENTS]: { items: [{ id: 'e1' }] },
      [USERS]: { items: [{ id: 'u1', name: 'Anna' }] },
    })

    const labels = page.findAll('button').map(nameOf)

    expect(labels).not.toContain(translate('group-members-revoke'))
    expect(labels).not.toContain(translate('group-members-move'))
  })
})
