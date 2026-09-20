import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { httpClientKey } from '@/shared/api'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal, signInAs } from '@/shared/testing'

import LessonsPage from './LessonsPage.vue'

/**
 * The lessons of one course, each with what its versions add up to.
 *
 * The three badges are the three states the server's rules allow: a lesson
 * being written, a lesson students are reading, and a lesson being revised
 * while the published text stays live.
 */
const LESSONS = '/edu/lessons'

const FULL = ['lessons:read', 'lessons:create', 'lessons:update'] as PermissionKey[]

const route = { route: { name: 'lessons', params: { courseId: 'c1' } } }

const lesson = (id: string, lessonNumber: number, title: string) => ({ id, lessonNumber, title })

const versions = (lessonId: string, entries: [number, string][]) => ({
  items: entries.map(([version, status]) => ({
    id: `${lessonId}-${version}`,
    lessonId,
    version,
    status,
  })),
})

const world: FakeAnswers = {
  [LESSONS]: {
    items: [lesson('l1', 1, 'Alphabet'), lesson('l2', 2, 'Sandhi'), lesson('l3', 3, 'Cases')],
  },
  [`${LESSONS}/l1/versions`]: versions('l1', [[1, 'published']]),
  [`${LESSONS}/l2/versions`]: versions('l2', [
    [1, 'published'],
    [2, 'draft'],
  ]),
  [`${LESSONS}/l3/versions`]: versions('l3', [[1, 'draft']]),
  '/edu/courses/c1': { id: 'c1', name: 'Sanskrit from scratch' },
}

const over =
  (answers: FakeAnswers, permissions = FULL) =>
  () => ({
    components: { LessonsPage },
    setup() {
      signInAs(permissions)
      return {}
    },
    provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
    template: '<div class="p-[var(--space-6)]"><LessonsPage /></div>',
  })

const meta: Meta<typeof LessonsPage> = { title: 'Admin/Teaching/Lessons', component: LessonsPage }

export default meta
type Story = StoryObj<typeof LessonsPage>

export const Default: Story = { parameters: route, render: over(world) }

export const Loading: Story = {
  parameters: route,
  render: over({ ...world, [LESSONS]: pending() }),
}

export const Empty: Story = {
  parameters: route,
  render: over({ ...world, [LESSONS]: { items: [] } }),
}

export const Failed: Story = {
  parameters: route,
  render: over({ ...world, [LESSONS]: refusal(503, 'The lessons cannot be read right now') }),
}

export const Denied: Story = {
  parameters: route,
  render: over(world, ['lessons:read'] as PermissionKey[]),
}
