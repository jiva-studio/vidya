import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { httpClientKey } from '@/shared/api'
import { addMessages } from '@/shared/i18n'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal } from '@/shared/testing'

import { messages } from '../i18n'
import SchoolSettingsPage from './SchoolSettingsPage.vue'
import { installStoryRouter, signInWith } from './storyHarness'

addMessages(messages)
installStoryRouter()

const CONFIGS = '/edu/schools/school-1/configs'
const ROLES = '/edu/roles'

const FULL = ['schools:read', 'schools:update', 'roles:read'] as PermissionKey[]

const roles = {
  items: [
    { id: 'role-1', name: 'Студент', description: 'Учится' },
    { id: 'role-2', name: 'Преподаватель', description: 'Ведёт группу' },
  ],
}

const over =
  (answers: FakeAnswers, permissions = FULL) =>
  () => ({
    components: { SchoolSettingsPage },
    setup() {
      signInWith(permissions)
      return {}
    },
    provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
    template: '<div class="p-[--space-6]"><SchoolSettingsPage id="school-1" /></div>',
  })

const meta: Meta<typeof SchoolSettingsPage> = {
  title: 'Org/SchoolSettings',
  component: SchoolSettingsPage,
}

export default meta
type Story = StoryObj<typeof SchoolSettingsPage>

export const WithData: Story = {
  name: 'Данные',
  render: over({
    [CONFIGS]: { defaultStudentRoleId: 'role-1', studentRoleIds: ['role-1'] },
    [ROLES]: roles,
  }),
}

export const Empty: Story = {
  name: 'Пусто',
  render: over({ [CONFIGS]: { studentRoleIds: [] }, [ROLES]: { items: [] } }),
}

export const Loading: Story = {
  name: 'Загрузка',
  render: over({ [CONFIGS]: pending(), [ROLES]: pending() }),
}

export const Failed: Story = {
  name: 'Ошибка',
  render: over({ [CONFIGS]: refusal(500, 'Настройки не читаются'), [ROLES]: roles }),
}

export const WithoutRights: Story = {
  name: 'Без прав',
  render: over(
    {
      [CONFIGS]: { studentRoleIds: [] },
      [ROLES]: roles,
      [`PATCH ${CONFIGS}`]: refusal(403, 'Недостаточно прав, чтобы менять настройки'),
    },
    ['schools:read', 'roles:read'] as PermissionKey[],
  ),
}
