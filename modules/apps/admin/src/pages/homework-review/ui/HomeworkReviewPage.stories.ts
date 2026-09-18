import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { httpClientKey } from '@/shared/api'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal, signInAs } from '@/shared/testing'

import HomeworkReviewPage from './HomeworkReviewPage.vue'

/**
 * One piece of work, opened from a link, with the queue beside it.
 *
 * There is no comment field: `ReviewHomeworkRequest.comment` is dropped by the
 * server (§9), and a field that silently loses what was typed is worse than no
 * field at all (AC-29).
 */
const HOMEWORK = '/edu/homework'

const FULL = [
  'homework:read',
  'homework:grade',
  'enrollments:read',
  'users:read',
] as PermissionKey[]

const work = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  enrollmentId: 'e1',
  lessonVersionId: 'v7',
  sectionId: 's1',
  schoolId: 'school-1',
  status: 'pending',
  text: 'Три года практики научили меня прежде всего слушать, а уже потом отвечать.',
  submittedAt: '2026-09-10T08:00:00.000Z',
  ...over,
})

const world: FakeAnswers = {
  '/edu/courses': { items: [{ id: 'c1', name: 'Основы традиции' }] },
  '/edu/groups': { items: [{ id: 'g1', name: 'Утренняя группа' }] },
  [HOMEWORK]: {
    items: [{ id: 'h1', enrollmentId: 'e1', sectionId: 's1', status: 'pending' }],
  },
  [`${HOMEWORK}/h1`]: work('h1'),
  '/edu/enrollments/e1': {
    id: 'e1',
    courseId: 'c1',
    groupId: 'g1',
    studentId: 'u1',
    schoolId: 'school-1',
    status: 'accepted',
    createdAt: '2026-08-01T10:00:00.000Z',
  },
  '/edu/users/u1': { id: 'u1', name: 'Аня Иванова', email: 'a@example.com' },
}

const over =
  (answers: FakeAnswers, permissions = FULL) =>
  () => ({
    components: { HomeworkReviewPage },
    setup() {
      signInAs(permissions)
      return {}
    },
    provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
    template: '<div class="p-[--space-6]"><HomeworkReviewPage id="h1" /></div>',
  })

const meta: Meta<typeof HomeworkReviewPage> = {
  title: 'Edu/HomeworkReview',
  component: HomeworkReviewPage,
}

export default meta
type Story = StoryObj<typeof HomeworkReviewPage>

export const WithData: Story = { name: 'Данные', render: over(world) }

export const Empty: Story = {
  name: 'Пусто',
  render: over({ ...world, [HOMEWORK]: { items: [] } }),
}

export const Loading: Story = {
  name: 'Загрузка',
  render: over({ ...world, [HOMEWORK]: pending() }),
}

export const Failed: Story = {
  name: 'Ошибка',
  render: over({ ...world, [HOMEWORK]: refusal(503, 'Работа сейчас не читается') }),
}

export const WithoutRights: Story = {
  name: 'Без прав',
  render: over(world, ['homework:read', 'enrollments:read', 'users:read'] as PermissionKey[]),
}

/** The student answered a version of the lesson that has since been replaced. */
export const Superseded: Story = {
  name: 'Устаревшая версия',
  render: over({ ...world, [`${HOMEWORK}/h1`]: work('h1', { answeredSupersededVersion: true }) }),
}
