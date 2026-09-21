import type { CourseId, GroupId, GroupStatus } from '@vidya/domain'
import { asId, GroupStatuses, RECRUITING_GROUP_STATUS } from '@vidya/domain'
import type { GroupSummary } from '@vidya/protocol'
import { describe, expect, it } from 'vitest'

import { decidePlacement, groupsById } from '../model'
import type { PlacementRequest } from '../types'

const COURSE = asId<CourseId>('c1')
const WANTED = asId<GroupId>('g1')

const group = (over: Partial<GroupSummary> = {}): GroupSummary =>
  ({
    id: WANTED,
    courseId: COURSE,
    name: 'Morning',
    status: RECRUITING_GROUP_STATUS,
    ...over,
  }) as GroupSummary

const decide = (over: Partial<PlacementRequest> = {}) =>
  decidePlacement({
    courseId: COURSE,
    preferredGroupId: WANTED,
    groups: groupsById([group()]),
    ...over,
  })

describe('decidePlacement boundaries', () => {
  it('answers from an empty map without reaching for a group', () => {
    expect(decide({ groups: new Map() })).toEqual({ kind: 'place' })
  })

  it('needs no map at all when no group was asked for', () => {
    expect(decide({ preferredGroupId: undefined, groups: new Map() })).toEqual({ kind: 'place' })
  })

  // Ids are matched, not parsed, so a group under a differently cased id is a
  // different group.
  it('treats an id that differs only in case as a group it does not hold', () => {
    const groups = groupsById([group({ id: asId<GroupId>('G1') })])

    expect(decide({ groups })).toEqual({ kind: 'place' })
  })

  it('sends the wish straight through when the groups could not be read, present or not', () => {
    const passed = { kind: 'place', groupId: WANTED }

    expect(decide({ groupsUnreadable: true })).toEqual(passed)
    expect(decide({ groupsUnreadable: true, groups: new Map() })).toEqual(passed)
    expect(
      decide({ groupsUnreadable: true, groups: groupsById([group({ status: 'inactive' })]) }),
    ).toEqual(passed)
  })

  it('drops the wish rather than passing it on when nothing was asked for and nothing read', () => {
    expect(decide({ preferredGroupId: undefined, groupsUnreadable: true })).toEqual({
      kind: 'place',
    })
  })

  // Driven off the domain list so a status added later has to be decided here
  // rather than falling through to whichever branch happens to catch it.
  it.each<GroupStatus>([...GroupStatuses])(
    'places into a %s group only if it recruits',
    (status) => {
      const expected =
        status === RECRUITING_GROUP_STATUS ? { kind: 'place', groupId: WANTED } : { kind: 'review' }

      expect(decide({ groups: groupsById([group({ status })]) })).toEqual(expected)
    },
  )

  it('reviews a group on another course whatever its status', () => {
    for (const status of GroupStatuses) {
      const groups = groupsById([group({ status, courseId: asId<CourseId>('c2') })])

      expect(decide({ groups }), status).toEqual({ kind: 'review' })
    }
  })

  it('keeps the last group when the same id is read twice', () => {
    const groups = groupsById([group({ status: 'inactive' }), group()])

    expect(decide({ groups })).toEqual({ kind: 'place', groupId: WANTED })
  })
})
