import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { httpClientKey } from '@/shared/api'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal, signInAs } from '@/shared/testing'

import GroupMembersPage from './GroupMembersPage.vue'

/**
 * Who is in a group. The roster is the accepted requests that name it, and the
 * names come from one read of the school's people rather than one per row.
 */
const ENROLLMENTS = '/edu/enrollments'

const FULL = ['groups:read', 'enrollments:read', 'users:read'] as PermissionKey[]

const route = { route: { name: 'group-members', params: { groupId: 'g1' } } }

const member = (id: string, studentId: string) => ({
  id,
  courseId: 'c1',
  groupId: 'g1',
  studentId,
  schoolId: 'school-1',
  status: 'accepted',
  createdAt: '2026-02-01T10:00:00.000Z',
})

const world: FakeAnswers = {
  [ENROLLMENTS]: { items: [{ id: 'e1' }, { id: 'e2' }] },
  [`${ENROLLMENTS}/e1`]: member('e1', 'u1'),
  [`${ENROLLMENTS}/e2`]: member('e2', 'u2'),
  '/edu/users': {
    items: [
      { id: 'u1', name: 'Anya Ivanova' },
      { id: 'u2', name: 'Boris Petrov' },
    ],
  },
}

const over =
  (answers: FakeAnswers, permissions = FULL) =>
  () => ({
    components: { GroupMembersPage },
    setup() {
      signInAs(permissions)
      return {}
    },
    provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
    template: '<div class="p-[var(--space-6)]"><GroupMembersPage /></div>',
  })

const meta: Meta<typeof GroupMembersPage> = {
  title: 'Admin/Teaching/Members',
  component: GroupMembersPage,
}

export default meta
type Story = StoryObj<typeof GroupMembersPage>

export const Default: Story = { parameters: route, render: over(world) }

export const Loading: Story = {
  parameters: route,
  render: over({ ...world, [ENROLLMENTS]: pending() }),
}

export const Empty: Story = {
  parameters: route,
  render: over({ ...world, [ENROLLMENTS]: { items: [] } }),
}

export const Failed: Story = {
  parameters: route,
  render: over({ ...world, [ENROLLMENTS]: refusal(503, 'The roster cannot be read right now') }),
}

export const Denied: Story = {
  parameters: route,
  render: over({ ...world, '/edu/users': refusal(403, 'Forbidden') }, [
    'groups:read',
    'enrollments:read',
  ] as PermissionKey[]),
}
