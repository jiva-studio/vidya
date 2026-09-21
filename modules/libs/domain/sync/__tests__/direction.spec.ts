/**
 * Direction and ownership tables —.
 *
 * These two cases are the reason the tables are data rather than prose: a
 * collection added without a direction, or a two-way field owned by nobody,
 * fails here instead of surfacing as a row that silently never replicates.
 */

import type { SyncDirection } from '../direction'
import {
  clientOwnedFields,
  FIELD_OWNER,
  isTwoWaySyncCollection,
  ownsEveryField,
  serverOwnedFields,
  SYNC_DIRECTION,
  SyncDirections,
} from '../direction'
import { EnrollmentSyncFields, HomeworkSyncFields, SyncCollection, SyncCollections } from '../types'

describe('SYNC_DIRECTION', () => {
  //
  it('covers exactly the replicating collections', () => {
    expect(Object.keys(SYNC_DIRECTION).sort()).toEqual([...SyncCollections].sort())
  })

  it('names a known direction for every collection', () => {
    for (const collection of SyncCollections) {
      expect(SyncDirections).toContain(SYNC_DIRECTION[collection])
    }
  })

  it('replicates the catalogue of groups, downward', () => {
    // The table is read through a widened view on purpose: a missing key has to
    // arrive as a failed expectation naming it, not as a compile error that
    // takes every other case in this file down with it.
    const collections: readonly string[] = SyncCollections
    const direction = SYNC_DIRECTION as Readonly<Record<string, SyncDirection | undefined>>

    expect(collections).toContain('groups')

    // The school writes the group and the student only reads it: a place in a
    // group is assigned by moderation, never claimed from a phone.
    expect(direction.groups).toBe('down')
  })

  it('keeps content flowing down and student-written rows going up', () => {
    expect(SYNC_DIRECTION.courses).toBe('down')
    expect(SYNC_DIRECTION.lessons).toBe('down')
    expect(SYNC_DIRECTION.lesson_versions).toBe('down')
    expect(SYNC_DIRECTION.block_states).toBe('up')
    expect(SYNC_DIRECTION.enrollments).toBe('both')
    expect(SYNC_DIRECTION.homework).toBe('both')
  })
})

describe('EnrollmentSyncFields', () => {
  //
  it('names every field either side may write', () => {
    expect([...EnrollmentSyncFields].sort()).toEqual(
      [
        'status',
        'decidedById',
        'decidedAt',
        'groupId',
        'preferredGroupId',
        'preferredTimes',
        'comment',
        'archivedByStudentAt',
      ].sort(),
    )
  })

  it('names each field once', () => {
    expect([...new Set(EnrollmentSyncFields)]).toHaveLength(EnrollmentSyncFields.length)
  })
})

describe('FIELD_OWNER', () => {
  //
  it('covers every mutable field of every two-way collection', () => {
    const owned = (collection: 'homework' | 'enrollments'): string[] =>
      [...FIELD_OWNER[collection].client, ...FIELD_OWNER[collection].server].sort()

    expect([...new Set(owned('homework'))]).toEqual([...HomeworkSyncFields].sort())
    expect([...new Set(owned('enrollments'))]).toEqual([...new Set(EnrollmentSyncFields)].sort())
  })

  it('has an entry for exactly the two-way collections', () => {
    const twoWay = SyncCollections.filter((c) => SYNC_DIRECTION[c] === 'both')

    expect(Object.keys(FIELD_OWNER).sort()).toEqual([...twoWay].sort())
    for (const collection of twoWay) {
      expect(isTwoWaySyncCollection(collection)).toBe(true)
    }
  })

  it('lets the student write the request and the school write the answer', () => {
    expect([...FIELD_OWNER.enrollments.client].sort()).toEqual(
      ['status', 'preferredGroupId', 'preferredTimes', 'comment', 'archivedByStudentAt'].sort(),
    )
    expect([...FIELD_OWNER.enrollments.server].sort()).toEqual(
      ['status', 'decidedById', 'decidedAt', 'groupId', 'archivedByStudentAt'].sort(),
    )
  })

  it('gives both sides the stamp that hides a finished request', () => {
    // The student puts it on and takes it off; the server clears it when a new
    // decision brings the request back. Shared like `status`, never contested.
    expect(FIELD_OWNER.enrollments.client).toContain('archivedByStudentAt')
    expect(FIELD_OWNER.enrollments.server).toContain('archivedByStudentAt')
  })

  it('keeps the school-side archiving off the wire', () => {
    const both = [...FIELD_OWNER.enrollments.client, ...FIELD_OWNER.enrollments.server]

    expect(both).not.toContain('archivedBySchoolAt')
    expect(both).not.toContain('archivedBySchoolById')
  })

  it('gives the client something to write and the server something to answer', () => {
    for (const collection of Object.keys(FIELD_OWNER) as ('homework' | 'enrollments')[]) {
      expect(FIELD_OWNER[collection].client.length).toBeGreaterThan(0)
      expect(FIELD_OWNER[collection].server.length).toBeGreaterThan(0)
    }
  })
})

describe('ownership lookups', () => {
  it('gives a download-only collection to the server whole', () => {
    expect(ownsEveryField(serverOwnedFields('courses'))).toBe(true)
    expect(clientOwnedFields('courses')).toHaveLength(0)
  })

  it('gives an upload-only collection to the client whole', () => {
    expect(ownsEveryField(clientOwnedFields('block_states'))).toBe(true)
    expect(serverOwnedFields('block_states')).toHaveLength(0)
  })

  it('splits a two-way collection by name', () => {
    expect(clientOwnedFields('homework')).toEqual(['text', 'submittedAt'])
    expect(serverOwnedFields('homework')).toContain('status')
  })

  it('answers for every collection without throwing', () => {
    for (const collection of SyncCollections as readonly SyncCollection[]) {
      expect(Array.isArray(clientOwnedFields(collection))).toBe(true)
      expect(Array.isArray(serverOwnedFields(collection))).toBe(true)
    }
  })
})
