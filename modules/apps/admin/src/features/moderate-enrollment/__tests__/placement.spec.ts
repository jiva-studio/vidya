import type { CourseId, GroupId, GroupStatus } from '@vidya/domain'
import { asId } from '@vidya/domain'
import type { GroupSummary } from '@vidya/protocol'
import { describe, expect, it } from 'vitest'

import { decidePlacement, groupsById } from '../model'

const COURSE = asId<CourseId>('c1')
const OTHER_COURSE = asId<CourseId>('c2')
const WANTED = asId<GroupId>('g1')

const group = (over: Partial<GroupSummary> = {}): GroupSummary =>
  ({
    id: WANTED,
    courseId: COURSE,
    name: 'Morning',
    status: 'pending' as GroupStatus,
    ...over,
  }) as GroupSummary

const decide = (over: Partial<Parameters<typeof decidePlacement>[0]> = {}) =>
  decidePlacement({
    courseId: COURSE,
    preferredGroupId: WANTED,
    groups: groupsById([group()]),
    ...over,
  })

describe('decidePlacement', () => {
  it('places nobody in particular when no group was asked for', () => {
    expect(decide({ preferredGroupId: undefined })).toEqual({ kind: 'place' })
  })

  it('honours a group that is open and on this course', () => {
    expect(decide()).toEqual({ kind: 'place', groupId: WANTED })
  })

  it('accepts into the queue when the group asked for has gone', () => {
    expect(decide({ groups: groupsById([]) })).toEqual({ kind: 'place' })
  })

  // Only `pending` recruits. Placing into a closed group from the row would
  // skip the warning the review dialog exists to show.
  it.each<GroupStatus>(['active', 'inactive'])('sends a %s group to the dialog', (status) => {
    expect(decide({ groups: groupsById([group({ status })]) })).toEqual({ kind: 'review' })
  })

  // The server answers this with a 409, which on the row path looks like a
  // button that did nothing.
  it('sends a group belonging to another course to the dialog', () => {
    expect(decide({ groups: groupsById([group({ courseId: OTHER_COURSE })]) })).toEqual({
      kind: 'review',
    })
  })

  it('passes the wish through untouched when the groups could not be read', () => {
    expect(decide({ groups: groupsById([]), groupsUnreadable: true })).toEqual({
      kind: 'place',
      groupId: WANTED,
    })
  })
})
