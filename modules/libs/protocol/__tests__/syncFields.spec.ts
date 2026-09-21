import { SyncCollections } from '@vidya/domain'

import { SYNC_WIRE_FIELDS } from '../syncFields'

/**
 * The wire contract as a list of names.
 *
 * `wireContract.spec.ts` on each side compares its own projection table to this
 * one, which makes the two tables agree with each other but says nothing about
 * whether the contract names the right fields in the first place. A collection
 * missing from here is missing from both halves at once, and both halves stay
 * green while the data never leaves the server.
 *
 * The table is read through a widened view throughout: a key that does not
 * exist yet has to arrive as a failed expectation naming it, not as a compile
 * error that takes every other case in this file down with it.
 */
const wire = SYNC_WIRE_FIELDS as Readonly<Record<string, readonly string[] | undefined>>

describe('SYNC_WIRE_FIELDS', () => {
  it('covers exactly the collections that replicate', () => {
    expect(Object.keys(SYNC_WIRE_FIELDS).sort()).toEqual([...SyncCollections].sort())
  })

  it('names each field of a collection once', () => {
    for (const fields of Object.values(SYNC_WIRE_FIELDS)) {
      expect([...new Set(fields)]).toHaveLength(fields.length)
    }
  })

  describe('groups', () => {
    it('carries the card a recruiting student reads', () => {
      // `startsAt` and `status` are what §4.7 reads to tell a group that is
      // still recruiting from one that has closed. Without them the device has
      // a name and nothing to decide with.
      expect(wire.groups ?? []).toEqual(
        expect.arrayContaining(['id', 'courseId', 'name', 'description', 'startsAt', 'status']),
      )
    })
  })

  describe('enrollments', () => {
    it('carries what the student asked for', () => {
      expect(wire.enrollments ?? []).toEqual(
        expect.arrayContaining(['preferredGroupId', 'preferredTimes', 'comment']),
      )
    })

    it('carries the stamp that hides a finished request', () => {
      // A clean install has no local row, so nothing is merged and the stamp
      // arrives from the projection or not at all. Left off the wire, a request
      // the student put away comes back on the next reinstall.
      expect(wire.enrollments ?? []).toContain('archivedByStudentAt')
    })

    it('leaves the archiving the school does off the wire', () => {
      expect(wire.enrollments ?? []).not.toContain('archivedBySchoolAt')
      expect(wire.enrollments ?? []).not.toContain('archivedBySchoolById')
    })
  })
})
