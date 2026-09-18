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
import CourseFormPage from '../ui/CourseFormPage.vue'

addMessages(messages)
locale.value = 'en'

const SCHOOL = asId<SchoolId>('11111111-1111-1111-1111-111111111111')
const COURSE = '22222222-2222-2222-2222-222222222222'
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

const open = async (path: string, answers: Record<string, unknown>) => {
  const routes = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/courses', name: 'courses', component: blank },
      { path: '/courses/new', name: 'course-create', component: blank },
      { path: '/courses/:courseId/edit', name: 'course-edit', component: blank },
    ],
  })

  await routes.push(path)
  await routes.isReady()

  const transport = fakeHttpClient(answers)
  const page = mountWithApp(CourseFormPage, {
    global: { plugins: [routes], provide: { [httpClientKey as symbol]: transport.client } },
  })
  await flushPromises()

  return { transport, page }
}

describe('CourseFormPage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    signIn()
  })

  it('sends exactly the fields the schema has, and the current school', async () => {
    const { transport, page } = await open('/courses/new', { [COURSES]: { id: COURSE } })

    await page.get('input').setValue('Sanskrit grammar')
    await page.get('form').trigger('submit')
    await flushPromises()

    const call = transport.callsTo(COURSES)[0]
    expect(call.method).toBe('POST')
    expect(call.body).toEqual({
      schoolId: SCHOOL,
      name: 'Sanskrit grammar',
      description: '',
      learningType: 'individual',
    })
  })

  it('offers no field the schema cannot store', async () => {
    const { page } = await open('/courses/new', { [COURSES]: { id: COURSE } })

    const labels = page.findAll('label').map((label) => label.text())

    expect(labels).toEqual(['Name*', 'Description', 'Format', 'Individual', 'Group'])
  })

  it('refuses to send a course with no name, and says why', async () => {
    const { transport, page } = await open('/courses/new', { [COURSES]: { id: COURSE } })

    await page.get('form').trigger('submit')
    await flushPromises()

    expect(transport.calls).toHaveLength(0)
    expect(page.text()).toContain('A course needs a name.')
  })

  it('fills the form from the course it is editing', async () => {
    const { page } = await open(`/courses/${COURSE}/edit`, {
      [`${COURSES}/${COURSE}`]: {
        id: COURSE,
        schoolId: SCHOOL,
        name: 'Kirtan practice',
        description: 'Two evenings a week',
        learningType: 'group',
      },
    })

    expect((page.get('input').element as HTMLInputElement).value).toBe('Kirtan practice')
  })

  it('shows the reason a save was refused instead of a generic failure', async () => {
    const { page } = await open('/courses/new', {
      [COURSES]: refusal(409, 'A course with that name already exists'),
    })

    await page.get('input').setValue('Sanskrit grammar')
    await page.get('form').trigger('submit')
    await flushPromises()

    expect(page.text()).toContain('A course with that name already exists')
  })

  it('offers a retry rather than an empty form when the course could not be read', async () => {
    const { page } = await open(`/courses/${COURSE}/edit`, {
      [`${COURSES}/${COURSE}`]: refusal(500, 'The database is asleep'),
    })

    expect(page.text()).toContain('The database is asleep')
    expect(page.find('form').exists()).toBe(false)
  })
})
