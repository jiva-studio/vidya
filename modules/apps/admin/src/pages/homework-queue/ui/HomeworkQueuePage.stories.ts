import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { httpClientKey } from '@/shared/api'
import { addMessages } from '@/shared/i18n'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal } from '@/shared/testing'

import { messages } from '../i18n'
import HomeworkQueuePage from './HomeworkQueuePage.vue'
import { installStoryRouter, signInWith } from './storyHarness'

addMessages(messages)
installStoryRouter()

const HOMEWORK = '/edu/homework'

const FULL = [
  'homework:read',
  'homework:grade',
  'enrollments:read',
  'users:read',
] as PermissionKey[]

const queue = [
  {
    id: 'h1',
    enrollmentId: 'e1',
    sectionId: 's1',
    status: 'pending',
    submittedAt: '2026-09-10T08:00:00.000Z',
  },
  {
    id: 'h2',
    enrollmentId: 'e2',
    sectionId: 's1',
    status: 'pending',
    submittedAt: '2026-09-11T08:00:00.000Z',
  },
]

const work = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  enrollmentId: id === 'h1' ? 'e1' : 'e2',
  lessonVersionId: 'v7',
  sectionId: 's1',
  schoolId: 'school-1',
  status: 'pending',
  text: 'Три года практики научили меня прежде всего слушать, а уже потом отвечать.',
  submittedAt: '2026-09-10T08:00:00.000Z',
  ...over,
})

const enrollment = (id: string, studentId: string) => ({
  id,
  courseId: 'c1',
  groupId: 'g1',
  studentId,
  schoolId: 'school-1',
  status: 'accepted',
  createdAt: '2026-08-01T10:00:00.000Z',
})

const world: FakeAnswers = {
  '/edu/courses': { items: [{ id: 'c1', name: 'Основы традиции' }] },
  '/edu/groups': { items: [{ id: 'g1', name: 'Утренняя группа' }] },
  [HOMEWORK]: { items: queue },
  [`${HOMEWORK}/h1`]: work('h1'),
  [`${HOMEWORK}/h2`]: work('h2'),
  '/edu/enrollments/e1': enrollment('e1', 'u1'),
  '/edu/enrollments/e2': enrollment('e2', 'u2'),
  '/edu/users/u1': { id: 'u1', name: 'Аня Иванова', email: 'a@example.com' },
  '/edu/users/u2': { id: 'u2', name: 'Борис Петров', email: 'b@example.com' },
}

const over =
  (answers: FakeAnswers, permissions = FULL) =>
  () => ({
    components: { HomeworkQueuePage },
    setup() {
      signInWith(permissions)
      return {}
    },
    provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
    template: '<div class="p-[--space-6]"><HomeworkQueuePage /></div>',
  })

const meta: Meta<typeof HomeworkQueuePage> = {
  title: 'Edu/HomeworkQueue',
  component: HomeworkQueuePage,
}

export default meta
type Story = StoryObj<typeof HomeworkQueuePage>

export const WithData: Story = { name: 'Данные', render: over(world) }

export const Empty: Story = { name: 'Пусто', render: over({ ...world, [HOMEWORK]: { items: [] } }) }

export const Loading: Story = {
  name: 'Загрузка',
  render: over({ ...world, [HOMEWORK]: pending() }),
}

export const Failed: Story = {
  name: 'Ошибка',
  render: over({ ...world, [HOMEWORK]: refusal(503, 'Очередь сейчас не читается') }),
}

export const WithoutRights: Story = {
  name: 'Без прав',
  render: over(world, ['homework:read', 'enrollments:read', 'users:read'] as PermissionKey[]),
}

/** Press j to open the work: it was answered against a version since replaced. */
export const Superseded: Story = {
  name: 'Устаревшая версия',
  render: over({
    ...world,
    [`${HOMEWORK}/h1`]: work('h1', { answeredSupersededVersion: true }),
  }),
}
