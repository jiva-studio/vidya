import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { CourseId } from '@vidya/domain'
import { asId } from '@vidya/domain'

import { addMessages } from '@/shared/i18n'

import { messages } from '../i18n'
import CoursesTable from './CoursesTable.vue'

addMessages(messages)

/**
 * The substance of the courses screen, in the five states every list has.
 *
 * The page around it reads the transport and hands the rows down, so the states
 * are props here rather than answers: what the screen looks like is settled by
 * these four values and nothing else.
 */
const meta: Meta<typeof CoursesTable> = { title: 'Edu/CoursesTable', component: CoursesTable }

export default meta
type Story = StoryObj<typeof CoursesTable>

const rows = [
  { id: asId<CourseId>('c1'), name: 'Sanskrit grammar', description: 'Cases, verbs and sandhi' },
  { id: asId<CourseId>('c2'), name: 'Bhagavad-gita', description: 'Read with the commentary' },
  { id: asId<CourseId>('c3'), name: 'Kirtan practice', description: '' },
]

export const Data: Story = { args: { rows, canCreate: true, canEdit: true } }

export const Empty: Story = { args: { rows: [], canCreate: true, canEdit: true } }

export const Loading: Story = { args: { rows: [], loading: true, canCreate: true } }

export const Failed: Story = {
  args: { rows: [], error: 'The database is not answering.', canCreate: true },
}

export const WithoutRights: Story = { args: { rows, canCreate: false, canEdit: false } }
