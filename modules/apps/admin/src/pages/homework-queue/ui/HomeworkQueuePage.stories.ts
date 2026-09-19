import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { httpClientKey } from '@/shared/api'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal, signInAs } from '@/shared/testing'

import HomeworkQueuePage from './HomeworkQueuePage.vue'

/** The list and nothing else: a row leads to the work, where it is decided on. */
const HOMEWORK = '/edu/homework'

const FULL = ['homework:read', 'enrollments:read', 'users:read'] as PermissionKey[]

const summary = (id: string, enrollmentId: string, submittedAt: string) => ({
  id,
  enrollmentId,
  sectionId: 's1',
  status: 'pending',
  submittedAt,
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
  '/edu/courses': { items: [{ id: 'c1', name: 'Foundations of the tradition' }] },
  '/edu/groups': { items: [{ id: 'g1', name: 'Morning group' }] },
  [HOMEWORK]: {
    items: [
      summary('h1', 'e1', '2026-09-10T08:00:00.000Z'),
      summary('h2', 'e2', '2026-09-11T08:00:00.000Z'),
    ],
  },
  '/edu/enrollments/e1': enrollment('e1', 'u1'),
  '/edu/enrollments/e2': enrollment('e2', 'u2'),
  '/edu/users/u1': { id: 'u1', name: 'Anya Ivanova', email: 'a@example.com' },
  '/edu/users/u2': { id: 'u2', name: 'Boris Petrov', email: 'b@example.com' },
}

const over =
  (answers: FakeAnswers, permissions = FULL) =>
  () => ({
    components: { HomeworkQueuePage },
    setup() {
      signInAs(permissions)
      return {}
    },
    provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
    template: '<HomeworkQueuePage />',
  })

const meta: Meta<typeof HomeworkQueuePage> = {
  title: 'Admin/Daily work/Homework queue',
  component: HomeworkQueuePage,
}

export default meta
type Story = StoryObj<typeof HomeworkQueuePage>

export const WithData: Story = { name: 'Data', render: over(world) }

export const Empty: Story = { name: 'Empty', render: over({ ...world, [HOMEWORK]: { items: [] } }) }

export const Loading: Story = { name: 'Loading', render: over({ ...world, [HOMEWORK]: pending() }) }

export const Failed: Story = {
  name: 'Error',
  render: over({ ...world, [HOMEWORK]: refusal(503, 'The queue cannot be read right now') }),
}

/** Work may be read without the right to read people: the rows keep their places. */
export const WithoutRights: Story = {
  name: 'No permission',
  render: over(world, ['homework:read'] as PermissionKey[]),
}
