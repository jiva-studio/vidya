/**
 * Direction and ownership tables —.
 *
 * These two cases are the reason the tables are data rather than prose: a
 * collection added without a direction, or a two-way field owned by nobody,
 * fails here instead of surfacing as a row that silently never replicates.
 */

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

  it('keeps content flowing down and student-written rows going up', () => {
    expect(SYNC_DIRECTION.courses).toBe('down')
    expect(SYNC_DIRECTION.lessons).toBe('down')
    expect(SYNC_DIRECTION.lesson_versions).toBe('down')
    expect(SYNC_DIRECTION.block_states).toBe('up')
    expect(SYNC_DIRECTION.enrollments).toBe('both')
    expect(SYNC_DIRECTION.homework).toBe('both')
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
