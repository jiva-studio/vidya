import { testingDataSource } from '@vidya/api/shared/datasources'
import { Enrollment, Group } from '@vidya/entities'
import { DataSource, ObjectLiteral } from 'typeorm'

/**
 * Where an entity and the migrations describe the same table differently.
 *
 * Nothing makes them agree. `synchronize` is off, so the migrations own the
 * schema and the entity is only a description of it — and a description that
 * has drifted is worse than none, because TypeORM plans queries from it and
 * everyone reads it as the truth. The drift is invisible to every other suite:
 * a unique nobody built raises no error, and a column type the driver happens
 * to round-trip reads back fine, until one day it does not.
 *
 * Groups are where the plan first starts using this entity, which is the moment
 * to make the description true rather than to preserve the gap.
 */

/** Anything TypeORM accepts as an entity reference — here, an entity class. */
type EntityClass = new (...args: never[]) => ObjectLiteral

const typeOf = (ds: DataSource, entity: EntityClass, property: string): string => {
  const column = ds.getMetadata(entity).findColumnWithPropertyName(property)
  if (column === undefined) throw new Error(`${entity.name}.${property} is not a column`)

  return String(column.type)
}

/** The unique constraints an entity declares, as lists of property names. */
const uniquesOf = (ds: DataSource, entity: EntityClass): string[][] =>
  ds
    .getMetadata(entity)
    .uniques.map((unique) => unique.columns.map((column) => column.propertyName).sort())

describe('the entities describe the schema the migrations built', () => {
  let ds: DataSource

  beforeEach(async () => {
    ds = await testingDataSource()
  })

  afterEach(async () => {
    await ds.destroy()
  })

  describe('a group name', () => {
    it('is not unique across the whole system', () => {
      // `017_scope_group_names_to_their_course.sql` dropped exactly that
      // constraint: two schools that never hear of each other both get to run
      // a "Morning group", and the second one used to get a 500 for it.
      expect(uniquesOf(ds, Group).filter((columns) => columns.length === 1)).toEqual([])
    })

    it('is unique within its course, or is left to the migration that says so', () => {
      // `Course` and `Lesson` were scoped the same way by migration 009 and
      // declare nothing, leaving the constraint where it is built. Either shape
      // is honest; a constraint over the name alone is not, because no such
      // constraint exists any more.
      for (const columns of uniquesOf(ds, Group)) {
        expect(columns).toEqual(['courseId', 'name'])
      }
    })
  })

  describe('the instant a group started', () => {
    it('carries its zone, as the column has since migration 016', () => {
      // Without the zone Postgres keeps the wall-clock digits and drops the
      // offset, so a group starting at 09:00 in Moscow reads as 09:00 in
      // Lisbon. The column was changed; the entity was not, and an inferred
      // `Date` maps to `timestamp` — the very type 016 migrated away from.
      expect(typeOf(ds, Group, 'startsAt')).toBe('timestamptz')
    })

    it('is declared the way every other instant in this schema is', () => {
      expect(typeOf(ds, Group, 'startsAt')).toBe(typeOf(ds, Enrollment, 'decidedAt'))
    })
  })
})
