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

export const WithData: Story = { name: 'Data', render: over({ [USERS]: { items } }) }

export const Empty: Story = { name: 'Empty', render: over({ [USERS]: { items: [] } }) }

export const Loading: Story = { name: 'Loading', render: over({ [USERS]: pending() }) }

export const Failed: Story = {
  name: 'Error',
  render: over({ [USERS]: refusal(500, 'Список людей не читается') }),
}

export const WithoutRights: Story = {
  name: 'No permission',
  render: over({ [USERS]: { items } }, ['users:read'] as PermissionKey[]),
}
