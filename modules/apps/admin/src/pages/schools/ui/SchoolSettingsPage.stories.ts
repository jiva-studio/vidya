import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'

import { httpClientKey } from '@/shared/api'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending, refusal, signInAs } from '@/shared/testing'

import SchoolSettingsPage from './SchoolSettingsPage.vue'

const CONFIGS = '/edu/schools/school-1/configs'
const ROLES = '/edu/roles'

const FULL = ['schools:read', 'schools:update', 'roles:read'] as PermissionKey[]

const roles = {
  items: [
    { id: 'role-1', name: 'Student', description: 'Учится' },
    { id: 'role-2', name: 'Teacher', description: 'Leads a group' },
  ],
}

const over =
  (answers: FakeAnswers, permissions = FULL) =>
  () => ({
    components: { SchoolSettingsPage },
    setup() {
      signInAs(permissions)
      return {}
    },
    provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
    template: '<div class="p-[var(--space-6)]"><SchoolSettingsPage id="school-1" /></div>',
  })

const meta: Meta<typeof SchoolSettingsPage> = {
  title: 'Admin/Organisation/School settings',
  component: SchoolSettingsPage,
}

export default meta
type Story = StoryObj<typeof SchoolSettingsPage>

export const WithData: Story = {
  name: 'Data',
  render: over({
    [CONFIGS]: { defaultStudentRoleId: 'role-1', studentRoleIds: ['role-1'] },
    [ROLES]: roles,
  }),
}

export const Empty: Story = {
  name: 'Empty',
  render: over({ [CONFIGS]: { studentRoleIds: [] }, [ROLES]: { items: [] } }),
}

export const Loading: Story = {
  name: 'Loading',
  render: over({ [CONFIGS]: pending(), [ROLES]: pending() }),
}

export const Failed: Story = {
  name: 'Error',
  render: over({ [CONFIGS]: refusal(500, 'Настройки не читаются'), [ROLES]: roles }),
}

export const WithoutRights: Story = {
  name: 'No permission',
  render: over(
    {
      [CONFIGS]: { studentRoleIds: [] },
      [ROLES]: roles,
      [`PATCH ${CONFIGS}`]: refusal(403, 'Недостаточно прав, чтобы менять настройки'),
    },
    ['schools:read', 'roles:read'] as PermissionKey[],
  ),
}
