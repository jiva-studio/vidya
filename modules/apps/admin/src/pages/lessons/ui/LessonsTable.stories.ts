import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { LessonId } from '@vidya/domain'
import { asId } from '@vidya/domain'

import { addMessages } from '@/shared/i18n'

import { messages } from '../i18n'
import LessonsTable from './LessonsTable.vue'

addMessages(messages)

/**
 * The lessons of a course, with what each one's versions add up to.
 *
 * The three badges are the three states the server's rules allow: a lesson
 * being written, a lesson students are reading, and a lesson being revised
 * while the published text stays live.
 */
const meta: Meta<typeof LessonsTable> = { title: 'Edu/LessonsTable', component: LessonsTable }

export default meta
type Story = StoryObj<typeof LessonsTable>

const rows = [
  {
    id: asId<LessonId>('l1'),
    lessonNumber: 1,
    title: 'The alphabet',
    state: 'published' as const,
    publishedVersion: 1,
  },
  {
    id: asId<LessonId>('l2'),
    lessonNumber: 2,
    title: 'Sandhi',
    state: 'revising' as const,
    publishedVersion: 1,
    draftVersion: 2,
  },
  {
    id: asId<LessonId>('l3'),
    lessonNumber: 3,
    title: 'Cases',
    state: 'draft' as const,
    draftVersion: 1,
  },
]

export const Data: Story = { args: { rows, canCreate: true, canEdit: true } }

export const Empty: Story = { args: { rows: [], canCreate: true, canEdit: true } }

export const Loading: Story = { args: { rows: [], loading: true, canCreate: true } }

export const Failed: Story = {
  args: { rows: [], error: 'The lessons could not be loaded.', canCreate: true },
}

export const WithoutRights: Story = { args: { rows, canCreate: false, canEdit: false } }
