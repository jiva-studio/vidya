import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { httpClientKey } from '@/shared/api'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal, signInAs } from '@/shared/testing'

import RoleFormPage from './RoleFormPage.vue'

const ROLE = '/edu/roles/role-1'

const FULL = ['roles:create', 'roles:update'] as PermissionKey[]

const over =
  (answers: FakeAnswers, props: Record<string, unknown> = {}, permissions = FULL) =>
  () => ({
    components: { RoleFormPage },
    setup() {
      signInAs(permissions)
      return { props }
    },
    provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
    template: '<div class="p-[--space-6]"><RoleFormPage v-bind="props" /></div>',
  })

const role = {
  id: 'role-1',
  name: 'Преподаватель',
  description: 'Ведёт группу и проверяет работы',
  schoolId: 'school-1',
  permissions: ['courses:read', 'homework:read', 'homework:grade'],
}

const meta: Meta<typeof RoleFormPage> = { title: 'Org/RoleForm', component: RoleFormPage }

export default meta
type Story = StoryObj<typeof RoleFormPage>

export const WithData: Story = {
  name: 'Данные',
  render: over({ [ROLE]: role }, { id: 'role-1' }),
}

export const Empty: Story = { name: 'Пусто', render: over({ 'POST /edu/roles': { id: 'role-2' } }) }

export const Loading: Story = {
  name: 'Загрузка',
  render: over({ [ROLE]: pending() }, { id: 'role-1' }),
}

export const Failed: Story = {
  name: 'Ошибка',
  render: over({ [ROLE]: refusal(404, 'Такой роли нет') }, { id: 'role-1' }),
}

export const WithoutRights: Story = {
  name: 'Без прав',
  render: over(
    { 'POST /edu/roles': refusal(403, 'Недостаточно прав, чтобы создать роль') },
    {},
    [] as PermissionKey[],
  ),
}
