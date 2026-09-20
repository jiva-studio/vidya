import type { PermissionKey } from '@vidya/domain'
import { AlertDialog } from '@vidya/ui'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { HomeworkStatusBadge } from '@/entities/homework'
import { GradePicker, ReviewActions } from '@/features/grade-homework'
import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, mountWithApp, pending, refusal } from '@/shared/testing'

import { messages } from '../i18n'
import HomeworkReviewPage from '../ui/HomeworkReviewPage.vue'
import ReviewQueueNav from '../ui/ReviewQueueNav.vue'

const HOMEWORK = '/edu/homework'
const blank = { template: '<div />' }
const shell = { template: '<RouterView />' }

const signIn = (permissions: PermissionKey[]) => {
  const claims = {
    sub: 'u9',
    exp: 2_000_000_000,
    permissions: [{ sid: 'school-1', p: permissions }],
  }
  useSession().start({ accessToken: `h.${btoa(JSON.stringify(claims))}.s`, refreshToken: 'r' })
}

const summary = (id: string) => ({
  id,
  enrollmentId: 'e1',
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

const world = (over: FakeAnswers = {}): FakeAnswers => ({
  '/edu/courses': { items: [{ id: 'c1', name: 'Основы' }] },
  '/edu/groups': { items: [{ id: 'g1', name: 'Утренняя' }] },
  [HOMEWORK]: { items: [summary('h1'), summary('h2')] },
  [`${HOMEWORK}/h1`]: work('h1'),
  [`${HOMEWORK}/h2`]: work('h2'),
  '/edu/enrollments/e1': {
    id: 'e1',
    courseId: 'c1',
    groupId: 'g1',
    studentId: 'u1',
    schoolId: 'school-1',
    status: 'accepted',
    createdAt: '2026-09-01T10:00:00.000Z',
  },
  '/edu/users/u1': { id: 'u1', name: 'Аня Иванова', email: 'a@example.com', roles: [] },

  // A version is read through its lesson, so the lesson holding it is found
  // among the course's lessons before the screen can name it or link to it.
  '/edu/lessons': { items: [{ id: 'l1', lessonNumber: 1, title: 'Алфавит' }] },
  '/edu/lessons/l1/versions': {
    items: [{ id: 'v7', lessonId: 'l1', version: 1, status: 'published' }],
  },
  ...over,
})

// The screen listens on the window, so one left mounted would keep answering
// keys pressed by the next test.
const mounted: { unmount: () => void }[] = []

const mountPage = async (answers: FakeAnswers, settle = true) => {
  const transport = fakeHttpClient(answers)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/homework', name: 'homework-queue', component: blank },
      {
        path: '/homework/:id',
        name: 'homework-review',
        component: HomeworkReviewPage,
        props: true,
      },
      { path: '/lessons/:lessonId/versions/:versionId', name: 'lesson-version', component: blank },
    ],
  })
  await router.push('/homework/h1')
  await router.isReady()

  const page = mountWithApp(shell, {
    global: {
      plugins: [router],
      provide: { [httpClientKey as symbol]: transport.client },
      stubs: { RouterLink: false },
    },
  })

  mounted.push(page)
  if (settle) await flushPromises()
  return { transport, router, page }
}

const press = async (key: string) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  await flushPromises()
}

const patched = (transport: { calls: { method: string }[] }) =>
  transport.calls.find((call) => call.method === 'PATCH')

// The wording of every button is the copy track's to change, so the decisions
// are found by what they are rather than by what they say: a mark is a figure,
// and the two that are not are accept and return, in that order.
type Page = ReturnType<typeof mountWithApp>

const decisions = (page: Page) =>
  page
    .findComponent(ReviewActions)
    .findAll('button')
    .filter((button) => !/^\d+$/.test(button.text()))

const acceptButton = (page: Page) => decisions(page)[0]
const returnButton = (page: Page) => decisions(page)[1]

const markButton = (page: Page, mark: number) =>
  page
    .findComponent(GradePicker)
    .findAll('button')
    .find((button) => button.text() === String(mark))

const remaining = (page: Page) => page.findComponent(ReviewQueueNav).props('remaining')

describe('HomeworkReviewPage', () => {
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

  it('shows the work with who handed it in, for what, and when', async () => {
    const { page } = await mountPage(world())

    expect(page.text()).toContain('Ответ h1')
    expect(page.text()).toContain('Аня Иванова')
    expect(page.text()).toContain('Основы')
    expect(page.text()).toContain('Утренняя')
    expect(page.text()).toContain('Алфавит')
  })

  it('shows that it is loading, and our own words when it will not load', async () => {
    const { page } = await mountPage(world({ [`${HOMEWORK}/h1`]: pending() }), false)
    expect(page.find('[role="status"]').exists()).toBe(true)

    const failed = await mountPage(world({ [`${HOMEWORK}/h1`]: refusal(503, 'Работа недоступна') }))
    const alert = failed.page.find('[role="alert"]')
    expect(alert.text()).not.toContain('Работа недоступна')
    expect(alert.text().length).toBeGreaterThan(0)
  })

  it('accepts with the mark a quick button gives it', async () => {
    const { transport, page } = await mountPage(
      world({ 'PATCH /edu/homework/h1/review': work('h1', { status: 'accepted', grade: 80 }) }),
    )

    await markButton(page, 80)?.trigger('click')
    await acceptButton(page).trigger('click')
    await flushPromises()

    expect(patched(transport)).toMatchObject({
      path: `${HOMEWORK}/h1/review`,
      body: { status: 'accepted', grade: 80 },
    })
  })

  it('accepts with a mark typed into the field, and refuses to without one', async () => {
    const { transport, page } = await mountPage(
      world({ 'PATCH /edu/homework/h1/review': work('h1', { status: 'accepted', grade: 73 }) }),
    )

    await press('a')
    expect(patched(transport)).toBeUndefined()

    await page.find('input[inputmode="numeric"]').setValue('73')
    await press('a')

    expect(patched(transport)).toMatchObject({ body: { status: 'accepted', grade: 73 } })
  })

  it('keeps the browser spinner away from the mark', async () => {
    const { page } = await mountPage(world())

    expect(page.find('input[type="number"]').exists()).toBe(false)
    expect(page.find('input[inputmode="numeric"]').exists()).toBe(true)
  })

  it('returns work only after the consequence has been named', async () => {
    const { transport, page } = await mountPage(
      world({ 'PATCH /edu/homework/h1/review': work('h1', { status: 'returned' }) }),
    )

    await returnButton(page).trigger('click')
    expect(patched(transport)).toBeUndefined()
    expect(page.findComponent(AlertDialog).props('open')).toBe(true)

    page.findComponent(AlertDialog).vm.$emit('confirm')
    await flushPromises()

    expect(patched(transport)).toMatchObject({
      path: `${HOMEWORK}/h1/review`,
      body: { status: 'returned' },
    })
  })

  it('asks for the return on r, without sending it', async () => {
    const { transport, page } = await mountPage(world())

    await press('r')

    expect(page.findComponent(AlertDialog).props('open')).toBe(true)
    expect(patched(transport)).toBeUndefined()
  })

  it('draws no decision without the right to grade', async () => {
    useSession().end()
    signIn(['homework:read', 'enrollments:read', 'users:read'] as PermissionKey[])

    const { page } = await mountPage(world())

    expect(page.findComponent(ReviewActions).findAll('button')).toHaveLength(0)
    expect(page.find('input[inputmode="numeric"]').exists()).toBe(false)
  })

  it('marks work answered against a version since replaced, and links to that version', async () => {
    const { page } = await mountPage(
      world({ [`${HOMEWORK}/h1`]: work('h1', { answeredSupersededVersion: true }) }),
    )

    expect(page.text()).toContain('больше не опубликована')
    expect(page.find('a').attributes('href')).toBe('/lessons/l1/versions/v7')
  })

  it('says how many works are left and moves to the next one', async () => {
    const { router, page } = await mountPage(world())

    expect(remaining(page)).toBe(1)

    await page.findComponent(ReviewQueueNav).find('button').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.params.id).toBe('h2')
    expect(page.text()).toContain('Ответ h2')
    expect(remaining(page)).toBe(0)
  })

  it('moves to the next work on n, and offers the list when none is left', async () => {
    const { router, page } = await mountPage(world())

    await press('n')

    expect(router.currentRoute.value.params.id).toBe('h2')

    await press('n')

    expect(router.currentRoute.value.params.id).toBe('h2')
    expect(page.find('a').attributes('href')).toBe('/homework')
  })

  it('leaves the decided work on screen when nothing follows it', async () => {
    const { page } = await mountPage(
      world({
        [HOMEWORK]: { items: [summary('h1')] },
        'PATCH /edu/homework/h1/review': work('h1', { status: 'accepted', grade: 90 }),
      }),
    )

    await markButton(page, 90)?.trigger('click')
    await acceptButton(page).trigger('click')
    await flushPromises()

    expect(page.text()).toContain('Ответ h1')
    expect(page.findComponent(HomeworkStatusBadge).props('status')).toBe('accepted')
    expect(remaining(page)).toBe(0)
  })

  it('leaves a key pressed inside a field to the field', async () => {
    const { transport, page } = await mountPage(world())

    const field = page.find('input[inputmode="numeric"]')
    await field.setValue('90')
    field.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    field.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }))
    await flushPromises()

    expect(patched(transport)).toBeUndefined()
    expect(page.text()).toContain('Ответ h1')
  })
})
