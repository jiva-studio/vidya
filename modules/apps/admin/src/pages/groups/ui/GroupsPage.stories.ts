import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { httpClientKey } from '@/shared/api'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal, signInAs } from '@/shared/testing'

import GroupsPage from './GroupsPage.vue'

/** The groups of the current school, in the five states every list has. */
const GROUPS = '/edu/groups'

const FULL = ['groups:read', 'groups:create', 'groups:update'] as PermissionKey[]

const items = [
  { id: 'g1', name: 'Morning group', courseId: 'c1' },
  { id: 'g2', name: 'Evening group', courseId: 'c1' },
]

const world: FakeAnswers = {
  [GROUPS]: { items },
  '/edu/courses': { items: [{ id: 'c1', name: 'Sanskrit from scratch' }] },
}

const over =
  (answers: FakeAnswers, permissions = FULL) =>
  () => ({
    components: { GroupsPage },
    setup() {
      signInAs(permissions)
      return {}
    },
    provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
    template: '<div class="p-[var(--space-6)]"><GroupsPage /></div>',
  })

const meta: Meta<typeof GroupsPage> = { title: 'Admin/Teaching/Groups', component: GroupsPage }

export default meta
type Story = StoryObj<typeof GroupsPage>

export const WithData: Story = { name: 'Data', render: over(world) }

export const Empty: Story = { name: 'Empty', render: over({ ...world, [GROUPS]: { items: [] } }) }

export const Loading: Story = { name: 'Loading', render: over({ ...world, [GROUPS]: pending() }) }

export const Failed: Story = {
  name: 'Error',
  render: over({ ...world, [GROUPS]: refusal(503, 'Группы сейчас не читаются') }),
}

export const WithoutRights: Story = {
  name: 'No permission',
  render: over(world, ['groups:read'] as PermissionKey[]),
}
