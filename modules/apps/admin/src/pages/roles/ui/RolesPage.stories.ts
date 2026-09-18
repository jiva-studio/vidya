import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { httpClientKey } from '@/shared/api'
import { addMessages } from '@/shared/i18n'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal } from '@/shared/testing'

import { messages } from '../i18n'
import RolesPage from './RolesPage.vue'
import { installStoryRouter, signInWith } from './storyHarness'

addMessages(messages)
installStoryRouter()

const ROLES = '/edu/roles'

const FULL = ['roles:read', 'roles:create', 'roles:update'] as PermissionKey[]

const over =
  (answers: FakeAnswers, permissions = FULL) =>
  () => ({
    components: { RolesPage },
    setup() {
      signInWith(permissions)
      return {}
    },
    provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
    template: '<div class="p-[--space-6]"><RolesPage /></div>',
  })

const items = [
  { id: 'role-1', name: 'Владелец', description: 'Может всё в этой школе' },
  { id: 'role-2', name: 'Преподаватель', description: 'Ведёт группу и проверяет работы' },
]

const meta: Meta<typeof RolesPage> = { title: 'Org/Roles', component: RolesPage }

export default meta
type Story = StoryObj<typeof RolesPage>

export const WithData: Story = { name: 'Данные', render: over({ [ROLES]: { items } }) }

export const Empty: Story = { name: 'Пусто', render: over({ [ROLES]: { items: [] } }) }

export const Loading: Story = { name: 'Загрузка', render: over({ [ROLES]: pending() }) }

export const Failed: Story = {
  name: 'Ошибка',
  render: over({ [ROLES]: refusal(500, 'Роли не читаются') }),
}

export const WithoutRights: Story = {
  name: 'Без прав',
  render: over({ [ROLES]: { items } }, ['roles:read'] as PermissionKey[]),
}
