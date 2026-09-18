import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { EnrollmentStatus, IsoDateTime, UserId } from '@vidya/domain'
import { asId } from '@vidya/domain'

import { addMessages } from '@/shared/i18n'

import { messages } from '../i18n'
import GroupMembers from './GroupMembers.vue'

addMessages(messages)

/**
 * A group's roster: its accepted enrolments, with the names resolved.
 *
 * A member without a name is ordinary rather than broken — reading the user
 * list needs a permission a teacher may not hold — so the last row shows what
 * that looks like.
 */
const meta: Meta<typeof GroupMembers> = { title: 'Edu/GroupMembers', component: GroupMembers }

export default meta
type Story = StoryObj<typeof GroupMembers>

const member = (id: string, name: string | undefined, status: EnrollmentStatus) => ({
  enrollmentId: id,
  studentId: asId<UserId>(`u-${id}`),
  name,
  status,
  enrolledAt: '2026-02-01T10:00:00.000Z' as IsoDateTime,
})

const rows = [
  member('e1', 'Anna Ivanova', 'accepted'),
  member('e2', 'Boris Petrov', 'accepted'),
  member('e3', undefined, 'pending'),
]

export const Data: Story = { args: { rows } }

export const Empty: Story = { args: { rows: [] } }

export const Loading: Story = { args: { rows: [], loading: true } }

export const Failed: Story = { args: { rows: [], error: 'The members could not be loaded.' } }
