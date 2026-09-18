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
    template: '<div class="p-[--space-6]"><UsersPage /></div>',
  })

const items = [
  { id: 'user-1', name: 'Анна Смирнова' },
  { id: 'user-2', name: 'Пётр Иванов' },
]

const meta: Meta<typeof UsersPage> = { title: 'Org/Users', component: UsersPage }

export default meta
type Story = StoryObj<typeof UsersPage>

export const WithData: Story = { name: 'Данные', render: over({ [USERS]: { items } }) }

export const Empty: Story = { name: 'Пусто', render: over({ [USERS]: { items: [] } }) }

export const Loading: Story = { name: 'Загрузка', render: over({ [USERS]: pending() }) }

export const Failed: Story = {
  name: 'Ошибка',
  render: over({ [USERS]: refusal(500, 'Список людей не читается') }),
}

export const WithoutRights: Story = {
  name: 'Без прав',
  render: over({ [USERS]: { items } }, ['users:read'] as PermissionKey[]),
}
