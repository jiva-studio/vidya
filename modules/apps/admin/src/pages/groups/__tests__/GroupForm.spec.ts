import type { SchoolId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages, locale } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import { fakeHttpClient, mountWithApp, refusal } from '@/shared/testing'

import { messages } from '../i18n'
import GroupFormPage from '../ui/GroupFormPage.vue'

addMessages(messages)
locale.value = 'en'

const SCHOOL = asId<SchoolId>('11111111-1111-1111-1111-111111111111')
const COURSE = '22222222-2222-2222-2222-222222222222'
const GROUP = '44444444-4444-4444-4444-444444444444'

const GROUPS = '/edu/groups'
const COURSES = '/edu/courses'

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

const courses = { items: [{ id: COURSE, name: 'Sanskrit grammar' }] }

const open = async (path: string, answers: Record<string, unknown>) => {
  const routes = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/groups', name: 'groups', component: blank },
      { path: '/groups/new', name: 'group-create', component: blank },
      { path: '/groups/:groupId/edit', name: 'group-edit', component: blank },
    ],
  })

  await routes.push(path)
  await routes.isReady()

  const transport = fakeHttpClient(answers)
  const page = mountWithApp(GroupFormPage, {
    attachTo: document.body,
    global: { plugins: [routes], provide: { [httpClientKey as symbol]: transport.client } },
  })
  await flushPromises()

  return { transport, page }
}

describe('GroupFormPage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    signIn()
  })

  it('offers no field the schema cannot store', async () => {
    const { page } = await open('/groups/new', { [COURSES]: courses, [GROUPS]: { id: GROUP } })

    const labels = page.findAll('label').map((label) => label.text())

    expect(labels).toEqual(['Name*', 'Course*', 'Description'])
  })

  it('sends the course chosen in the combobox with the name and the description', async () => {
    const { transport, page } = await open('/groups/new', {
      [COURSES]: courses,
      [GROUPS]: { id: GROUP },
    })

    const [name, search] = page.findAll('input')
    await name.setValue('Morning group')

    await search.trigger('focus')
    await flushPromises()
    await search.trigger('keydown', { key: 'ArrowDown' })
    await search.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    await page.get('form').trigger('submit')
    await flushPromises()

    expect(transport.callsTo(GROUPS)[0].body).toEqual({
      courseId: COURSE,
      name: 'Morning group',
      description: '',
    })
  })

  it('refuses to send a group with no name and no course, and says why', async () => {
    const { transport, page } = await open('/groups/new', {
      [COURSES]: courses,
      [GROUPS]: { id: GROUP },
    })

    await page.get('form').trigger('submit')
    await flushPromises()

    expect(transport.callsTo(GROUPS)).toHaveLength(0)
    expect(page.text()).toContain('Enter a name.')
    expect(page.text()).toContain('Choose a course.')
  })

  it('locks the course of a group that already exists', async () => {
    const { page } = await open(`/groups/${GROUP}/edit`, {
      [COURSES]: courses,
      [`${GROUPS}/${GROUP}`]: {
        id: GROUP,
        courseId: COURSE,
        name: 'Morning group',
        description: '',
      },
    })

    expect(page.text()).toContain('The course cannot be changed once the group exists')
  })

  it('reports the reason a save was refused, and keeps it out of the form', async () => {
    const { page, transport } = await open('/groups/new', {
      [COURSES]: courses,
      [`POST ${GROUPS}`]: refusal(409, 'That group name is taken'),
    })

    const [name, search] = page.findAll('input')
    await name.setValue('Morning group')
    await search.trigger('focus')
    await flushPromises()
    await search.trigger('keydown', { key: 'ArrowDown' })
    await search.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    await page.get('form').trigger('submit')
    await flushPromises()

    expect(transport.failures).toEqual([
      { key: 'failure-conflict', reason: 'That group name is taken' },
    ])
    expect(page.text()).not.toContain('That group name is taken')
  })
})
