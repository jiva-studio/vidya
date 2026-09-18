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
import GroupsPage from '../ui/GroupsPage.vue'

addMessages(messages)
locale.value = 'en'

const SCHOOL = asId<SchoolId>('11111111-1111-1111-1111-111111111111')
const GROUPS = '/edu/groups'

const blank = { template: '<div />' }

const token = (permissions: unknown) =>
  `header.${btoa(JSON.stringify({ sub: 'u1', exp: 2_000_000_000, permissions }))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')}.sig`

const signIn = (granted: string[]) =>
  useSession().start({
    accessToken: token([{ sid: SCHOOL, p: granted }]),
    refreshToken: 'refresh',
  })

const routes = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/groups', name: 'groups', component: blank },
      { path: '/groups/new', name: 'group-create', component: blank },
      { path: '/groups/:groupId/edit', name: 'group-edit', component: blank },
      { path: '/groups/:groupId/members', name: 'group-members', component: blank },
    ],
  })

const open = async (answers: Record<string, unknown>) => {
  const transport = fakeHttpClient(answers)
  const page = mountWithApp(GroupsPage, {
    global: { plugins: [routes()], provide: { [httpClientKey as symbol]: transport.client } },
  })
  await flushPromises()

  return { transport, page }
}

describe('GroupsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    signIn(['*'])
  })

  it('shows the groups once they arrive', async () => {
    const { page } = await open({ [GROUPS]: { items: [{ id: 'g1', name: 'Morning group' }] } })

    expect(page.text()).toContain('Morning group')
  })

  it('shows a loading state while the groups are on their way', async () => {
    const { page } = await open({ [GROUPS]: pending() })

    expect(page.findComponent(Skeleton).exists()).toBe(true)
  })

  it('says what to do next when the school has no groups', async () => {
    const { page } = await open({ [GROUPS]: { items: [] } })

    expect(page.text()).toContain('No groups yet')
    expect(page.text()).toContain('Create a group')
  })

  it('shows the reason the server gave, and offers another go', async () => {
    const { transport, page } = await open({ [GROUPS]: refusal(500, 'The database is asleep') })

    expect(page.text()).toContain('The database is asleep')

    const retry = page.findAll('button').find((button) => button.text() === 'Try again')
    await retry?.trigger('click')
    await flushPromises()

    expect(transport.callsTo(GROUPS)).toHaveLength(2)
  })

  it('hides the create action from someone who may not create', async () => {
    useSession().end()
    signIn(['groups:read'])

    const { page } = await open({ [GROUPS]: { items: [] } })

    expect(page.text()).not.toContain('New group')
    expect(page.text()).not.toContain('Create a group')
  })
})
