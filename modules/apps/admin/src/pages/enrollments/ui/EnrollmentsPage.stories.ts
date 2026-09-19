import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { httpClientKey } from '@/shared/api'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal, signInAs } from '@/shared/testing'

import EnrollmentsPage from './EnrollmentsPage.vue'

const ENROLLMENTS = '/edu/enrollments'

const FULL = ['enrollments:read', 'enrollments:moderate', 'users:read'] as PermissionKey[]

const items = [
  { id: 'e1', courseId: 'c1', status: 'pending', createdAt: '2026-09-01T10:00:00.000Z' },
  { id: 'e2', courseId: 'c1', status: 'accepted', createdAt: '2026-08-20T10:00:00.000Z' },
  {
    id: 'e3',
    courseId: 'c1',
    groupId: 'g1',
    status: 'accepted',
    createdAt: '2026-08-10T10:00:00.000Z',
  },
]

const people: Record<string, string> = {
  e1: 'Anya Ivanova',
  e2: 'Boris Petrov',
  e3: 'Vera Sidorova',
}

const detailsOf = (id: string) => ({
  ...items.find((item) => item.id === id),
  studentId: `u-${id}`,
  schoolId: 'school-1',
  decidedById: id === 'e1' ? undefined : 'u-admin',
  decidedAt: id === 'e1' ? undefined : '2026-08-21T09:00:00.000Z',
})

const world: FakeAnswers = {
  '/edu/courses': { items: [{ id: 'c1', name: 'Foundations of the tradition' }] },
  '/edu/groups': { items: [{ id: 'g1', name: 'Morning group' }] },
  [ENROLLMENTS]: { items },
  [`${ENROLLMENTS}/e1`]: detailsOf('e1'),
  [`${ENROLLMENTS}/e2`]: detailsOf('e2'),
  [`${ENROLLMENTS}/e3`]: detailsOf('e3'),
  '/edu/users/u-admin': { id: 'u-admin', name: 'Maria Kuznetsova', email: 'm@example.com' },
  '/edu/users/u-e1': { id: 'u-e1', name: people.e1, email: 'a@example.com' },
  '/edu/users/u-e2': { id: 'u-e2', name: people.e2, email: 'b@example.com' },
  '/edu/users/u-e3': { id: 'u-e3', name: people.e3, email: 'v@example.com' },
}

const over =
  (answers: FakeAnswers, permissions = FULL) =>
  () => ({
    components: { EnrollmentsPage },
    setup() {
      signInAs(permissions)
      return {}
    },
    provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
    template: '<div class="p-[var(--space-6)]"><EnrollmentsPage /></div>',
  })

const meta: Meta<typeof EnrollmentsPage> = {
  title: 'Admin/Daily work/Requests',
  component: EnrollmentsPage,
}

export default meta
type Story = StoryObj<typeof EnrollmentsPage>

export const WithData: Story = { name: 'Data', render: over(world) }

export const Empty: Story = {
  name: 'Empty',
  render: over({ ...world, [ENROLLMENTS]: { items: [] } }),
}

export const Loading: Story = {
  name: 'Loading',
  render: over({ ...world, [ENROLLMENTS]: pending() }),
}

export const Failed: Story = {
  name: 'Error',
  render: over({ ...world, [ENROLLMENTS]: refusal(500, 'Заявки сейчас не читаются') }),
}

export const WithoutRights: Story = {
  name: 'No permission',
  render: over(world, ['enrollments:read', 'users:read'] as PermissionKey[]),
}
