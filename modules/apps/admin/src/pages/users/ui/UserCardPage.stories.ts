import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { httpClientKey } from '@/shared/api'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal, signInAs } from '@/shared/testing'

import UserCardPage from './UserCardPage.vue'

const USER = '/edu/users/user-1'
const USER_ROLES = '/edu/users/user-1/roles'
const USER_SCHOOLS = '/edu/users/user-1/schools'

const FULL = ['users:read', 'users:update', 'roles:read', 'schools:read'] as PermissionKey[]
const READER = ['users:read', 'roles:read', 'schools:read'] as PermissionKey[]

const over =
  (answers: FakeAnswers, permissions = FULL) =>
  () => ({
    components: { UserCardPage },
    setup() {
      signInAs(permissions)
      return {}
    },
    provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
    template: '<div class="p-[var(--space-6)]"><UserCardPage id="user-1" /></div>',
  })

const card: FakeAnswers = {
  [USER]: {
    id: 'user-1',
    name: 'Anna Smirnova',
    email: 'anna@example.com',
    phone: '+7 900 000-00-00',
    roles: [],
  },
  [USER_ROLES]: { userRoles: [{ roleId: 'role-2' }] },
  [`POST ${USER_ROLES}`]: {},
  [USER_SCHOOLS]: { userSchools: ['school-1'] },
  '/edu/roles': {
    items: [
      { id: 'role-1', name: 'Owner', description: 'Can do everything in this school' },
      { id: 'role-2', name: 'Teacher', description: 'Leads a group' },
    ],
  },
  '/edu/schools': { items: [{ id: 'school-1', name: 'First school' }] },
}

const meta: Meta<typeof UserCardPage> = { title: 'Org/UserCard', component: UserCardPage }

export default meta
type Story = StoryObj<typeof UserCardPage>

export const WithData: Story = { name: 'Data', render: over(card) }

export const Empty: Story = {
  name: 'Empty',
  render: over({
    ...card,
    [USER_ROLES]: { userRoles: [] },
    [USER_SCHOOLS]: { userSchools: [] },
    '/edu/roles': { items: [] },
  }),
}

export const Loading: Story = { name: 'Loading', render: over({ ...card, [USER]: pending() }) }

export const Failed: Story = {
  name: 'Error',
  render: over({ ...card, [USER]: refusal(404, 'Такого человека нет') }),
}

export const WithoutRights: Story = { name: 'No permission', render: over(card, READER) }
