import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { httpClientKey } from '@/shared/api'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal, signInAs } from '@/shared/testing'

import UsersPage from './UsersPage.vue'

const USERS = '/edu/users'

const FULL = ['users:read', 'users:update'] as PermissionKey[]

const over =
  (answers: FakeAnswers, permissions = FULL) =>
  () => ({
    components: { UsersPage },
    setup() {
      signInAs(permissions)
      return {}
    },
    provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
    template: '<div class="p-[var(--space-6)]"><UsersPage /></div>',
  })

const items = [
  { id: 'user-1', name: 'Anna Smirnova' },
  { id: 'user-2', name: 'Pyotr Ivanov' },
]

const meta: Meta<typeof UsersPage> = { title: 'Admin/Organisation/People', component: UsersPage }

export default meta
type Story = StoryObj<typeof UsersPage>

export const Default: Story = { render: over({ [USERS]: { items } }) }

export const Loading: Story = { render: over({ [USERS]: pending() }) }

export const Empty: Story = { render: over({ [USERS]: { items: [] } }) }

export const Failed: Story = {
  render: over({ [USERS]: refusal(500, 'The list of people cannot be read') }),
}

export const Denied: Story = {
  render: over({ [USERS]: { items } }, ['users:read'] as PermissionKey[]),
}
