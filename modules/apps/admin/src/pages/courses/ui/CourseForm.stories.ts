import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { addMessages } from '@/shared/i18n'

import { messages } from '../i18n'
import CourseForm from './CourseForm.vue'

addMessages(messages)

/**
 * The course form, which has three fields because the schema has three.
 *
 * A form is reached only by someone allowed to save it, so it has no "without
 * rights" state: the route refuses first, and the screen never renders.
 */
const meta: Meta<typeof CourseForm> = { title: 'Edu/CourseForm', component: CourseForm }

export default meta
type Story = StoryObj<typeof CourseForm>

const blank = { name: '', description: '', learningType: 'individual' as const }

const filled = {
  name: 'Sanskrit grammar',
  description: 'Cases, verbs and sandhi. Twelve lessons.',
  learningType: 'group' as const,
}

export const Data: Story = { args: { modelValue: filled } }

export const Empty: Story = { args: { modelValue: blank } }

export const Loading: Story = { args: { modelValue: filled, busy: true } }

export const Failed: Story = {
  args: { modelValue: filled, error: 'A course with that name already exists.' },
}
