import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { httpClientKey } from '@/shared/api'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal, signInAs } from '@/shared/testing'

import RolesPage from './RolesPage.vue'

const ROLES = '/edu/roles'

const FULL = ['roles:read', 'roles:create', 'roles:update'] as PermissionKey[]

const over =
  (answers: FakeAnswers, permissions = FULL) =>
  () => ({
    components: { RolesPage },
    setup() {
      signInAs(permissions)
      return {}
    },
    provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
    template: '<div class="p-[var(--space-6)]"><RolesPage /></div>',
  })

const items = [
  { id: 'role-1', name: 'Owner', description: 'Can do everything in this school' },
  { id: 'role-2', name: 'Teacher', description: 'Leads a group and reviews work' },
]

const meta: Meta<typeof RolesPage> = { title: 'Admin/Organisation/Roles', component: RolesPage }

export default meta
type Story = StoryObj<typeof RolesPage>

export const Default: Story = { render: over({ [ROLES]: { items } }) }

export const Loading: Story = { render: over({ [ROLES]: pending() }) }

export const Empty: Story = { render: over({ [ROLES]: { items: [] } }) }

export const Failed: Story = { render: over({ [ROLES]: refusal(500, 'The roles cannot be read') }) }

export const Denied: Story = {
  render: over({ [ROLES]: { items } }, ['roles:read'] as PermissionKey[]),
}
