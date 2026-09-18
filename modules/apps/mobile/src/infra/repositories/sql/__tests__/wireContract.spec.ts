import { SyncCollections } from '@vidya/domain'
import { diffAgainstWire, SYNC_ENVELOPE_FIELD, SYNC_WIRE_FIELDS } from '@vidya/protocol'
import { describe, expect, it } from 'vitest'

import { COLLECTION_PROJECTIONS, projectionOf } from '../collectionProjections'

/**
 *, device half: what this table expects to be sent is what the contract
 * says is sent.
 *
 * The server half lives in `@vidya/api` and holds its journal projections to
 * the same `SYNC_WIRE_FIELDS`. Two halves rather than one test on purpose: an
 * app may not import a service and a lib may not import either, so the contract
 * is the only place the two tables can meet. Pinning both to it is pinning them
 * to each other.
 *
 * Neither direction is cosmetic. A field this table names and the server never
 * sends arrives as a fallback — an empty string where an instant belongs, or a
 * skipped row whose scope cursor advances anyway, which is a row that a second
 * pull will not bring back either. A field the server sends and this table does
 * not name is dropped here in silence.
 */
describe('the local tables expect the fields the wire contract declares', () => {
  it('covers every collection the contract names, and no others', () => {
    expect(Object.keys(COLLECTION_PROJECTIONS).sort()).toEqual([...SyncCollections].sort())
    expect(Object.keys(SYNC_WIRE_FIELDS).sort()).toEqual([...SyncCollections].sort())
  })

  it.each([...SyncCollections])('%s expects exactly the declared fields', (collection) => {
    const projection = projectionOf(collection)

    // The two a device may hold without the wire carrying them: the school,
    // which `validateChange` folds in from the envelope for every collection,
    // and the tombstone column, which the `delete` op writes. Both are
    // structural — anything else named here and never sent is a defect.
    const filledLocally =
      projection.tombstone === null
        ? [SYNC_ENVELOPE_FIELD]
        : [SYNC_ENVELOPE_FIELD, tombstoneField(collection)]

    const expected = projection.columns.map((column) => column.field)
    const difference = diffAgainstWire(collection, expected, filledLocally)

    expect({ collection, ...difference }).toEqual({
      collection,
      unexpected: [],
      missing: [],
    })
  })

  it('names a tombstone column only where the collection has one', () => {
    // The exemption above is only sound if `tombstone` really is the column a
    // delete writes, rather than a spare name a projection may carry.
    const withTombstone = [...SyncCollections].filter(
      (collection) => projectionOf(collection).tombstone !== null,
    )

    expect(withTombstone).toEqual(['lesson_versions', 'enrollments'])
  })
})

/** The wire name of the column a delete writes for `collection`. */
function tombstoneField(collection: (typeof SyncCollections)[number]): string {
  const projection = projectionOf(collection)
  const column = projection.columns.find((entry) => entry.column === projection.tombstone)

  if (column === undefined) {
    throw new Error(`${collection}: tombstone ${projection.tombstone} is not a projected column`)
  }

  return column.field
}
