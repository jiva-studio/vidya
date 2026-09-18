import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { httpClientKey } from '@/shared/api'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal, signInAs } from '@/shared/testing'

import HomeworkReviewPage from './HomeworkReviewPage.vue'

/**
 * One work, with room to read it and the queue carried along beside it.
 *
 * There is no comment field: `ReviewHomeworkRequest.comment` is dropped by the
 * server, and a field that silently loses what was typed is worse than none.
 */
const HOMEWORK = '/edu/homework'

const FULL = [
  'homework:read',
  'homework:grade',
  'enrollments:read',
  'users:read',
] as PermissionKey[]

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
  text: 'Three years of practice taught me to listen first and answer afterwards.',
  submittedAt: '2026-09-10T08:00:00.000Z',
  ...over,
})

const world: FakeAnswers = {
  '/edu/courses': { items: [{ id: 'c1', name: 'Foundations of the tradition' }] },
  '/edu/groups': { items: [{ id: 'g1', name: 'Morning group' }] },
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
    createdAt: '2026-08-01T10:00:00.000Z',
  },
  '/edu/users/u1': { id: 'u1', name: 'Anya Ivanova', email: 'a@example.com' },
  '/edu/lessons': { items: [{ id: 'l1', lessonNumber: 1, title: 'The alphabet' }] },
  '/edu/lessons/l1/versions': {
    items: [{ id: 'v7', lessonId: 'l1', version: 1, status: 'published' }],
  },
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
    template: '<HomeworkReviewPage id="h1" />',
  })

const meta: Meta<typeof HomeworkReviewPage> = {
  title: 'Edu/HomeworkReview',
  component: HomeworkReviewPage,
}

export default meta
type Story = StoryObj<typeof HomeworkReviewPage>

export const WithData: Story = { name: 'Data', render: over(world) }

/** The last work of the queue: there is no next one, and the list is offered. */
export const Empty: Story = {
  name: 'Empty',
  render: over({ ...world, [HOMEWORK]: { items: [summary('h1')] } }),
}

export const Loading: Story = {
  name: 'Loading',
  render: over({ ...world, [`${HOMEWORK}/h1`]: pending() }),
}

export const Failed: Story = {
  name: 'Error',
  render: over({ ...world, [`${HOMEWORK}/h1`]: refusal(503, 'This work cannot be read') }),
}

/** Reading work is one right, deciding on it another: the decision is absent. */
export const WithoutRights: Story = {
  name: 'No permission',
  render: over(world, ['homework:read', 'enrollments:read', 'users:read'] as PermissionKey[]),
}

/** Answered against a version that has since been replaced. */
export const Superseded: Story = {
  name: 'Superseded version',
  render: over({
    ...world,
    [`${HOMEWORK}/h1`]: work('h1', { answeredSupersededVersion: true }),
  }),
}
