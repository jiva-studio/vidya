import { COLLECTION_PROJECTIONS } from '@vidya/api/sync'
import { SyncCollections } from '@vidya/domain'
import { diffAgainstWire, SYNC_WIRE_FIELDS } from '@vidya/protocol'

/**
 *, server half: what this service puts on the wire is what the contract
 * says the wire carries.
 *
 * The device half lives in `@vidya/mobile` and holds its projection table to
 * the same `SYNC_WIRE_FIELDS`. Two halves rather than one test on purpose: a
 * service may not import an app and a lib may not either, so the only place the
 * two tables can meet is the contract they both point at. Pinning both to it is
 * pinning them to each other — if the server's keys equal the contract and the
 * device's fields equal the contract, they equal one another, and any drift
 * fails on the side that drifted, naming the field.
 *
 * `project()` builds an object literal, so its keys do not depend on the entity
 * it is given: an empty one is enough to read the shape off, and it keeps this
 * test free of a database.
 */
describe('the journal projects the fields the wire contract declares', () => {
  const projections = Object.values(COLLECTION_PROJECTIONS)

  it('covers every collection the contract names, and no others', () => {
    expect(projections.map((projection) => projection.collection).sort()).toEqual(
      [...SyncCollections].sort(),
    )
    expect(Object.keys(SYNC_WIRE_FIELDS).sort()).toEqual([...SyncCollections].sort())
  })

  it.each(projections.map((projection) => [projection.collection, projection] as const))(
    '%s sends exactly the declared fields',
    (collection, projection) => {
      const sent = Object.keys(projection.project({} as never))
      const difference = diffAgainstWire(collection, sent)

      // `unexpected` is a field the device has never been told about: it will
      // be dropped there in silence. `missing` is a field the device is
      // waiting for: it lands as a fallback, or the row is skipped outright
      // while its scope cursor moves past it.
      expect({ collection, ...difference }).toEqual({
        collection,
        unexpected: [],
        missing: [],
      })
    },
  )
})
