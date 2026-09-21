import { COLLECTION_PROJECTIONS, projectionFor, SYNCED_ENTITY_NAMES } from '@vidya/api/sync'
import { Enrollment, Group } from '@vidya/entities'

/**
 * What the journal puts in a row, field by field.
 *
 * `wireContract.spec.ts` compares the *keys* of every projection to
 * `SYNC_WIRE_FIELDS`, which catches a field that is not declared and a declared
 * field that is not projected. It cannot catch the third case, and that is the
 * one that costs data: a key present with the wrong value. `archivedByStudentAt`
 * is the example the plan names — `mergeOwnedFields` treats an absent key as
 * "leave it alone" and a `null` as "clear it", so a projection that omits the
 * key when the column is empty can never take the stamp back off, and a request
 * the student un-hid stays hidden on the next device they install.
 *
 * `project()` builds an object literal, so an empty entity is enough to read
 * the shape off it, and this suite needs no database.
 */
const projectionOf = (entityName: string) => {
  const projection = projectionFor(entityName)
  if (projection === undefined) throw new Error(`no journal projection for ${entityName}`)

  return projection
}

describe('the entities that reach devices', () => {
  it('includes the groups of a course', () => {
    // A student who is not enrolled has no course scope, so the catalogue of
    // places has to reach them some other way or not at all.
    expect(SYNCED_ENTITY_NAMES).toContain(Group.name)
    expect(Object.keys(COLLECTION_PROJECTIONS)).toContain(Group.name)
  })
})

describe('the group projection', () => {
  it('is addressed to the school, which is the scope a stranger to the course holds', () => {
    const projection = projectionOf(Group.name)

    expect(projection.collection).toBe('groups')
    expect(projection.scopeKind).toBe('school')
  })

  it('journals every status, so closing recruitment is itself an event', () => {
    const projection = projectionOf(Group.name)
    const journals = projection.journals ?? (() => true)

    // Journalling only the recruiting ones would make `pending -> active`
    // produce no row at all: the group would stay in the device's catalogue
    // for ever, and §4.7 reads exactly that collection to learn it closed.
    for (const status of ['pending', 'active', 'inactive']) {
      expect(journals({ status } as never)).toBe(true)
    }
  })

  it('sends the start and the status, not only the name', () => {
    const sent = projectionOf(Group.name).project({
      id: 'g1',
      schoolId: 's1',
      courseId: 'c1',
      name: 'Tuesday evenings',
      status: 'pending',
    } as never)

    expect(sent).toMatchObject({
      id: 'g1',
      courseId: 'c1',
      name: 'Tuesday evenings',
      status: 'pending',
    })

    // A group still recruiting has no start date, and the device has to be
    // told so rather than left to invent a fallback instant for it.
    expect(Object.keys(sent)).toContain('startsAt')
    expect(sent.startsAt).toBeNull()
  })
})

describe('the enrolment projection', () => {
  const projected = (entity: Partial<Enrollment>): Record<string, unknown> =>
    projectionOf(Enrollment.name).project(entity as never)

  it('sends what the student asked for', () => {
    const sent = projected({})

    expect(sent).toMatchObject({
      preferredGroupId: null,
      preferredTimes: null,
      comment: null,
    })
  })

  it('names the student stamp even when there is none', () => {
    const sent = projected({})

    // Present and `null`, never absent: the merge reads an absent key as
    // "the server has nothing to say", and the stamp could then never be
    // cleared from a device that had already been told to set it.
    expect(Object.keys(sent)).toContain('archivedByStudentAt')
    expect(sent.archivedByStudentAt).toBeNull()
  })

  it('keeps the archiving the school does to itself', () => {
    const sent = projected({})

    expect(Object.keys(sent)).not.toContain('archivedBySchoolAt')
    expect(Object.keys(sent)).not.toContain('archivedBySchoolById')
  })
})
