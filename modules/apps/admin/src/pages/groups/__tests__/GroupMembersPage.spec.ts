import type { SchoolId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { Skeleton } from '@vidya/ui'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages, locale } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import { fakeHttpClient, mountWithApp, pending, refusal } from '@/shared/testing'

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

const signIn = () =>
  useSession().start({
    accessToken: token([{ sid: SCHOOL, p: ['*'] }]),
    refreshToken: 'refresh',
  })

const enrollment = (id: string, studentId: string) => ({
  id,
  courseId: 'c1',
  groupId: GROUP,
  studentId,
  schoolId: SCHOOL,
  status: 'accepted',
  createdAt: '2026-02-01T10:00:00.000Z',
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

describe('GroupMembersPage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    signIn()
  })

  it('reads the roster as the enrolments pointing at this group', async () => {
    const { transport } = await open({ [ENROLLMENTS]: { items: [] } })

    expect(transport.calls[0]).toMatchObject({ path: ENROLLMENTS, query: { groupId: GROUP } })
  })

  it('names the students in one request rather than one per row', async () => {
    const { transport, page } = await open({
      [`${ENROLLMENTS}/e1`]: enrollment('e1', 'u1'),
      [`${ENROLLMENTS}/e2`]: enrollment('e2', 'u2'),
      [ENROLLMENTS]: { items: [{ id: 'e1' }, { id: 'e2' }] },
      [USERS]: {
        items: [
          { id: 'u1', name: 'Anna' },
          { id: 'u2', name: 'Boris' },
        ],
      },
    })

    expect(page.text()).toContain('Anna')
    expect(page.text()).toContain('Boris')
    expect(transport.callsTo(USERS)).toHaveLength(1)
  })

  it('still lists the roster when the names may not be read', async () => {
    const { page } = await open({
      [`${ENROLLMENTS}/e1`]: enrollment('e1', 'u1'),
      [ENROLLMENTS]: { items: [{ id: 'e1' }] },
      [USERS]: refusal(403, 'Forbidden'),
    })

    expect(page.text()).toContain('u1')
  })

  it('shows a loading state while the roster is on its way', async () => {
    const { page } = await open({ [ENROLLMENTS]: pending() })

    expect(page.findComponent(Skeleton).exists()).toBe(true)
  })

  it('says how students get into a group when nobody is in it', async () => {
    const { page } = await open({ [ENROLLMENTS]: { items: [] } })

    expect(page.text()).toContain('Nobody is in this group yet')
    expect(page.text()).toContain('accept a request into this group')
  })

  it('shows the reason the server gave, and offers another go', async () => {
    const { transport, page } = await open({
      [ENROLLMENTS]: refusal(500, 'The database is asleep'),
    })

    expect(page.text()).toContain('The database is asleep')

    const retry = page.findAll('button').find((button) => button.text() === 'Try again')
    await retry?.trigger('click')
    await flushPromises()

    expect(transport.callsTo(ENROLLMENTS)).toHaveLength(2)
  })
})
