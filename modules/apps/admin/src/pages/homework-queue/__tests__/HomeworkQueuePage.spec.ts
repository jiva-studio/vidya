import '../../../../../../libs/ui/vitest.setup'

import type { PermissionKey } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, mountWithApp, pending, refusal } from '@/shared/testing'

import { messages } from '../i18n'
import HomeworkQueuePage from '../ui/HomeworkQueuePage.vue'

const HOMEWORK = '/edu/homework'
const blank = { template: '<div />' }

const signIn = (permissions: PermissionKey[]) => {
  const claims = {
    sub: 'u9',
    exp: 2_000_000_000,
    permissions: [{ sid: 'school-1', p: permissions }],
  }
  useSession().start({ accessToken: `h.${btoa(JSON.stringify(claims))}.s`, refreshToken: 'r' })
}

const summary = (id: string, enrollmentId: string) => ({
  id,
  enrollmentId,
  sectionId: 's1',
  status: 'pending',
  submittedAt: '2026-09-10T08:00:00.000Z',
})

const work = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  enrollmentId: 'e1',
  lessonVersionId: 'v7',
  sectionId: 's1',
  schoolId: 'school-1',
  status: 'pending',
  text: `Ответ ${id}`,
  submittedAt: '2026-09-10T08:00:00.000Z',
  ...over,
})

const enrollment = (id: string, studentId: string) => ({
  id,
  courseId: 'c1',
  studentId,
  schoolId: 'school-1',
  status: 'accepted',
  groupId: 'g1',
  createdAt: '2026-09-01T10:00:00.000Z',
})

const world = (over: FakeAnswers = {}): FakeAnswers => ({
  '/edu/courses': { items: [{ id: 'c1', name: 'Основы' }] },
  '/edu/groups': { items: [{ id: 'g1', name: 'Утренняя' }] },
  [HOMEWORK]: { items: [summary('h1', 'e1'), summary('h2', 'e2')] },
  [`${HOMEWORK}/h1`]: work('h1'),
  [`${HOMEWORK}/h2`]: work('h2', { enrollmentId: 'e2' }),
  '/edu/enrollments/e1': enrollment('e1', 'u1'),
  '/edu/enrollments/e2': enrollment('e2', 'u1'),
  '/edu/users/u1': { id: 'u1', name: 'Аня Иванова', email: 'a@example.com', roles: [] },

  // A version is read through its lesson, so the notice's link is only drawn
  // once the lesson holding it has been found among the course's lessons.
  '/edu/lessons': { items: [{ id: 'l1', lessonNumber: 1, title: 'Алфавит' }] },
  '/edu/lessons/l1/versions': {
    items: [{ id: 'v7', lessonId: 'l1', version: 1, status: 'published' }],
  },
  ...over,
})

// The pane listens on the window, so a screen left mounted would keep answering
// keys pressed by the next test.
const mounted: { unmount: () => void }[] = []

const mountPage = async (answers: FakeAnswers, settle = true) => {
  const transport = fakeHttpClient(answers)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/homework', name: 'homework-queue', component: blank },
      { path: '/lessons/:lessonId/versions/:versionId', name: 'lesson-version', component: blank },
    ],
  })
  await router.push('/homework')
  await router.isReady()

  const page = mountWithApp(HomeworkQueuePage, {
    global: {
      plugins: [router],
      provide: { [httpClientKey as symbol]: transport.client },
      stubs: { RouterLink: false },
    },
  })

  mounted.push(page)
  if (settle) await flushPromises()
  return { transport, page }
}

const press = async (key: string) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  await flushPromises()
}

const patched = (transport: { calls: { method: string }[] }) =>
  transport.calls.find((call) => call.method === 'PATCH')

describe('HomeworkQueuePage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    addMessages(messages)
    signIn(['homework:read', 'homework:grade', 'enrollments:read', 'users:read'] as PermissionKey[])
  })

  afterEach(() => {
    mounted.splice(0).forEach((page) => page.unmount())
    document.body.innerHTML = ''
  })

  it('asks for the work that is waiting and names the students', async () => {
    const { transport, page } = await mountPage(world())

    expect(transport.calls[0]).toMatchObject({ path: HOMEWORK, query: { status: 'pending' } })
    expect(page.text()).toContain('Аня Иванова')
    expect(transport.callsTo('/edu/users/u1')).toHaveLength(1)
  })

  it('shows that it is loading while the queue is on its way', async () => {
    const { page } = await mountPage(world({ [HOMEWORK]: pending() }), false)

    expect(page.find('[role="status"]').exists()).toBe(true)
  })

  it('says what to do next when nothing is waiting', async () => {
    const { page } = await mountPage(world({ [HOMEWORK]: { items: [] } }))

    expect(page.text()).toContain('Проверять нечего')
  })

  it('shows the reason the server gave and offers another attempt', async () => {
    const { page } = await mountPage(world({ [HOMEWORK]: refusal(503, 'Очередь недоступна') }))

    expect(page.find('[role="alert"]').text()).toContain('Очередь недоступна')
  })

  it('opens the first work on j and steps back on k', async () => {
    const { transport, page } = await mountPage(world())

    await press('j')
    expect(page.text()).toContain('Ответ h1')

    await press('j')
    expect(page.text()).toContain('Ответ h2')

    await press('k')
    expect(page.text()).toContain('Ответ h1')
    expect(transport.callsTo(`${HOMEWORK}/h1`)).toHaveLength(2)
  })

  it('accepts with the grade that was entered, from the keyboard', async () => {
    const { transport, page } = await mountPage(
      world({ 'PATCH /edu/homework/h1/review': work('h1', { status: 'accepted', grade: 5 }) }),
    )

    await press('j')
    await page.find('input[type="number"]').setValue('5')
    await press('a')

    expect(patched(transport)).toMatchObject({
      path: `${HOMEWORK}/h1/review`,
      body: { status: 'accepted', grade: 5 },
    })
  })

  it('does not accept without a grade', async () => {
    const { transport, page } = await mountPage(world())

    await press('j')
    await press('a')

    expect(patched(transport)).toBeUndefined()
    expect(page.text()).toContain('Ответ h1')
  })

  it('returns work only after the consequence has been named', async () => {
    const { transport } = await mountPage(
      world({ 'PATCH /edu/homework/h1/review': work('h1', { status: 'returned' }) }),
    )

    await press('j')
    await press('r')

    expect(patched(transport)).toBeUndefined()
    expect(document.body.textContent).toContain('Возврат потом не отменить')

    const confirm = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Вернуть на доработку',
    )
    confirm?.click()
    await flushPromises()

    expect(patched(transport)).toMatchObject({
      path: `${HOMEWORK}/h1/review`,
      body: { status: 'returned' },
    })
  })

  it('moves to the next work once one has been decided', async () => {
    const { page } = await mountPage(
      world({ 'PATCH /edu/homework/h1/review': work('h1', { status: 'accepted', grade: 5 }) }),
    )

    await press('j')
    await page.find('input[type="number"]').setValue('5')
    await press('a')

    expect(page.text()).toContain('Ответ h2')
  })

  it('marks work answered against a version since replaced, and links to that version', async () => {
    const { page } = await mountPage(
      world({ [`${HOMEWORK}/h1`]: work('h1', { answeredSupersededVersion: true }) }),
    )

    await press('j')

    expect(page.text()).toContain('больше не опубликована')
    expect(page.find('a').attributes('href')).toBe('/lessons/l1/versions/v7')
  })

  it('shows who reviewed the work and when', async () => {
    const { page } = await mountPage(
      world({
        [`${HOMEWORK}/h1`]: work('h1', {
          status: 'accepted',
          reviewedById: 'u1',
          reviewedAt: '2026-09-11T09:00:00.000Z',
        }),
      }),
    )

    await press('j')

    expect(page.text()).toContain('Проверил')
    expect(page.text()).toContain('Аня Иванова')
  })

  it('draws no decision without the right to grade', async () => {
    useSession().end()
    signIn(['homework:read', 'enrollments:read', 'users:read'] as PermissionKey[])

    const { page } = await mountPage(world())
    await press('j')

    const labels = page.findAll('button').map((button) => button.text())
    expect(labels).not.toContain('Принять')
    expect(labels).not.toContain('Вернуть на доработку')
    expect(page.find('input[type="number"]').exists()).toBe(false)
  })
})
