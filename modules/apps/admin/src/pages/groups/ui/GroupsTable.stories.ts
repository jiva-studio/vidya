import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { GroupId } from '@vidya/domain'
import { asId } from '@vidya/domain'

import { addMessages } from '@/shared/i18n'

import { messages } from '../i18n'
import GroupsTable from './GroupsTable.vue'

addMessages(messages)

/**
 * The groups list.
 *
 * One column, because `GroupSummary` is an id and a name: the course a group
 * belongs to is not on the wire here, and a column of blanks would be worse
 * than a column that is not there.
 */
const meta: Meta<typeof GroupsTable> = { title: 'Edu/GroupsTable', component: GroupsTable }

export default meta
type Story = StoryObj<typeof GroupsTable>

const rows = [
  { id: asId<GroupId>('g1'), name: 'Morning group' },
  { id: asId<GroupId>('g2'), name: 'Evening group' },
]

export const Data: Story = { args: { rows, canCreate: true, canEdit: true } }

export const Empty: Story = { args: { rows: [], canCreate: true, canEdit: true } }

export const Loading: Story = { args: { rows: [], loading: true, canCreate: true } }

export const Failed: Story = {
  args: { rows: [], error: 'The groups could not be loaded.', canCreate: true },
}

export const WithoutRights: Story = { args: { rows, canCreate: false, canEdit: false } }
