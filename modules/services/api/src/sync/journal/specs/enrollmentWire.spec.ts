import { COLLECTION_PROJECTIONS } from '@vidya/api/sync'
import { Enrollment } from '@vidya/entities'
import { diffAgainstWire, SYNC_WIRE_FIELDS } from '@vidya/protocol'

/**
 * Which half of the archiving leaves the server.
 *
 * The student's stamp has to arrive on a clean install, where there is no local
 * row to merge it onto; the school's two are an internal view and a device has
 * no column for them.
 */
describe('what an enrollment carries to a device', () => {
  const sent = (): string[] =>
    Object.keys(COLLECTION_PROJECTIONS.Enrollment.project({} as Enrollment))

  it('carries the stamp the student owns, and what the request asked for', () => {
    expect(sent()).toEqual(
      expect.arrayContaining([
        'archivedByStudentAt',
        'preferredGroupId',
        'preferredTimes',
        'comment',
      ]),
    )
  })

  it('leaves the archiving of the school behind', () => {
    expect(SYNC_WIRE_FIELDS.enrollments).not.toContain('archivedBySchoolAt')
    expect(SYNC_WIRE_FIELDS.enrollments).not.toContain('archivedBySchoolById')
    expect(sent()).not.toContain('archivedBySchoolAt')
    expect(sent()).not.toContain('archivedBySchoolById')
  })

  it('sends the declared fields and no others', () => {
    expect(diffAgainstWire('enrollments', sent())).toEqual({ unexpected: [], missing: [] })
  })
})
