import type { SchoolId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages, locale } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, mountWithApp } from '@/shared/testing'

import { messages } from '../i18n'
import CourseFormPage from '../ui/CourseFormPage.vue'

addMessages(messages)

const SCHOOL = asId<SchoolId>('11111111-1111-1111-1111-111111111111')
const COURSE = '22222222-2222-2222-2222-222222222222'
const COURSES = '/edu/courses'
const ONE_COURSE = `${COURSES}/${COURSE}`

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

const courseWith = (status: string) => ({
  id: COURSE,
  schoolId: SCHOOL,
  name: 'Kirtan practice',
  description: 'Two evenings a week',
  learningType: 'group',
  status,
})

const open = async (path: string, answers: FakeAnswers) => {
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

const editing = (status: string) =>
  open(`/courses/${COURSE}/edit`, {
    [ONE_COURSE]: courseWith(status),
    [`PATCH ${ONE_COURSE}`]: courseWith(status),
  })

const saved = (transport: Awaited<ReturnType<typeof open>>['transport']) =>
  transport.callsTo(ONE_COURSE).find((call) => call.method === 'PATCH')

const save = async (page: Awaited<ReturnType<typeof open>>['page']) => {
  await page.get('form').trigger('submit')
  await flushPromises()
}

describe('course publication', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    signIn()
    locale.value = 'en'
  })

  it('shows an unpublished course as one students cannot see yet', async () => {
    const { page } = await editing('draft')

    expect(page.text()).toContain('A draft: students do not see this course yet.')
  })

  it('says a published course is the one students see', async () => {
    const { page } = await editing('published')

    expect(page.text()).toContain('Students see this course in the school.')
  })

  it('publishes the course the operator switched on', async () => {
    const { transport, page } = await editing('draft')

    await page.find('[role="switch"]').trigger('click')
    await save(page)

    expect(saved(transport)).toMatchObject({ body: { status: 'published' } })
  })

  it('takes a published course back out of the students sight', async () => {
    const { transport, page } = await editing('published')

    await page.find('[role="switch"]').trigger('click')
    await save(page)

    expect(saved(transport)).toMatchObject({ body: { status: 'draft' } })
  })

  it('keeps the publication of a course nobody touched', async () => {
    const { transport, page } = await editing('published')

    await save(page)

    expect(saved(transport)).toMatchObject({ body: { status: 'published' } })
  })

  it('offers no publication switch for a course that does not exist yet', async () => {
    const { page } = await open('/courses/new', { [COURSES]: { id: COURSE } })

    expect(page.find('[role="switch"]').exists()).toBe(false)
  })

  it('never calls a draft inactive or disabled', async () => {
    const { page } = await editing('draft')

    expect(page.text()).not.toContain('Inactive')
    expect(page.text()).not.toContain('Disabled')
  })

  it('says in Russian that students do not see a draft yet', async () => {
    locale.value = 'ru'
    const { page } = await editing('draft')

    expect(page.text()).toContain('Черновик: студенты пока не видят курс.')
  })
})
