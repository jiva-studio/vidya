import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { PermissionKey } from '@vidya/domain'
import { ref } from 'vue'

import PermissionsPicker from './PermissionsPicker.vue'

const over =
  (permissions: PermissionKey[], readonly = false) =>
  () => ({
    components: { PermissionsPicker },
    setup: () => ({ held: ref(permissions), readonly }),
    template:
      '<div class="p-[var(--space-5)]"><PermissionsPicker v-model="held" :readonly="readonly" /></div>',
  })

const teacher = [
  'courses:read',
  'lessons:read',
  'groups:read',
  'enrollments:read',
  'homework:read',
  'homework:grade',
] as PermissionKey[]

const odd = ['courses:delete', 'lessons:publish', 'users:update'] as PermissionKey[]

const meta: Meta<typeof PermissionsPicker> = {
  title: 'Admin/Parts/Roles/Permission picker',
  component: PermissionsPicker,
}

export default meta
type Story = StoryObj<typeof PermissionsPicker>

export const Empty: Story = { render: over([]) }

export const TeacherRole: Story = { name: 'Teacher role', render: over(teacher) }

export const Everything: Story = { name: 'Everything', render: over(['*'] as PermissionKey[]) }

export const OddCombination: Story = { name: 'Odd combination', render: over(odd) }

export const ReadOnly: Story = { name: 'Read only', render: over(teacher, true) }
