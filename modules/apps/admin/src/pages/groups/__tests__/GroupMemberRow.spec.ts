import type { EnrollmentStatus } from '@vidya/domain'
import { EnrollmentStatuses } from '@vidya/domain'
import { Badge } from '@vidya/ui'
import { describe, expect, it } from 'vitest'

import { addMessages, locale } from '@/shared/i18n'
import { mountWithApp } from '@/shared/testing'

import { messages } from '../i18n'
import GroupMemberRow from '../ui/GroupMemberRow.vue'

addMessages(messages)
locale.value = 'en'

const member = (status: EnrollmentStatus) => ({
  enrollmentId: '55555555-5555-5555-5555-555555555555',
  name: 'Anna Petrova',
  status,
  enrolledAt: '2026-02-01T10:00:00.000Z',
})

const open = (status: EnrollmentStatus) =>
  mountWithApp(GroupMemberRow, { props: { row: member(status) } })

describe('GroupMemberRow', () => {
  it('reads the status of every member the roster can hold', () => {
    for (const status of EnrollmentStatuses) {
      const row = open(status)

      expect(row.text()).not.toContain(`group-members-status-${status}`)
    }
  })

  it('gives a member who left the course a badge of their own', () => {
    const row = open('withdrawn')

    expect(row.findComponent(Badge).props('tone')).not.toBe('neutral')
    expect(row.text()).not.toContain('group-members-status-withdrawn')
  })

  it('gives a member whose place was taken back a badge of their own', () => {
    // A revoked place leaves the student in the group: `groupId` is not
    // cleared, so this row is on the screen today.
    const row = open('revoked')

    expect(row.findComponent(Badge).props('tone')).not.toBe('neutral')
    expect(row.text()).not.toContain('group-members-status-revoked')
  })

  it('still reads an accepted member as accepted', () => {
    const row = open('accepted')

    expect(row.findComponent(Badge).props('tone')).toBe('success')
    expect(row.text()).toContain('Accepted')
  })
})
