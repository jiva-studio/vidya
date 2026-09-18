import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { addMessages } from '@/shared/i18n'

import { messages } from '../i18n'
import GroupForm from './GroupForm.vue'

addMessages(messages)

/**
 * The group form: a name, the course, and a note.
 *
 * Editing locks the course, because every enrolment already points at it and
 * the update request carries no field for changing it.
 */
const meta: Meta<typeof GroupForm> = { title: 'Edu/GroupForm', component: GroupForm }

export default meta
type Story = StoryObj<typeof GroupForm>

const courses = [
  { value: 'c1', label: 'Sanskrit grammar' },
  { value: 'c2', label: 'Bhagavad-gita' },
]

const blank = { name: '', courseId: '', description: '' }

const filled = {
  name: 'Morning group',
  courseId: 'c1',
  description: 'Tuesday and Thursday, at seven.',
}

export const Data: Story = { args: { modelValue: filled, courses } }

export const Empty: Story = { args: { modelValue: blank, courses } }

export const Loading: Story = { args: { modelValue: filled, courses, busy: true } }

export const Failed: Story = {
  args: { modelValue: filled, courses, error: 'A group with that name already exists.' },
}

export const CourseLocked: Story = { args: { modelValue: filled, courses, courseLocked: true } }
