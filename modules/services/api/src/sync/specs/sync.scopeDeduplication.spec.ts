import * as domain from '@vidya/domain'
import { Enrollment } from '@vidya/entities'
import { DataSource, Repository } from 'typeorm'

import { SchoolMembership } from '../ports'
import { SyncScopesService } from '../services/scopes.service'

const STUDENT = domain.asId<domain.UserId>('11111111-1111-4111-8111-111111111111')
const SCHOOL = domain.asId<domain.SchoolId>('22222222-2222-4222-8222-222222222222')
const COURSE = domain.asId<domain.CourseId>('33333333-3333-4333-8333-333333333333')

const WHEN_THE_STUDENT_TIDIED_UP = new Date('2026-09-05T09:00:00.000Z')

type Row = Partial<Enrollment> & { studentId: domain.UserId; status: domain.EnrollmentStatus }

/**
 * A history on one course is still one course.
 *
 * `SYNC_MAX_SCOPES` counts what is granted, so a scope named twice spends the
 * budget of a scope the student would otherwise have been given.
 */
describe('the scopes a student is granted', () => {
  const serviceOver = (rows: readonly Row[], schools: readonly domain.SchoolId[] = []) => {
    const repository = {
      findBy: (where: Partial<Row>) =>
        Promise.resolve(
          rows.filter((row) =>
            Object.entries(where).every(([key, value]) => (row as never)[key] === value),
          ),
        ),
    } as unknown as Repository<Enrollment>

    const membership: SchoolMembership = { schoolsOf: () => Promise.resolve([...schools]) }

    return new SyncScopesService(repository, membership, {} as DataSource)
  }

  const coursesOf = async (service: SyncScopesService): Promise<domain.SyncScopeRef[]> =>
    (await service.scopesFor(STUDENT)).filter((scope) => scope.kind === 'course')

  it('names a course once when the student has taken it twice', async () => {
    const service = serviceOver([
      { studentId: STUDENT, schoolId: SCHOOL, courseId: COURSE, status: 'accepted' },
      { studentId: STUDENT, schoolId: SCHOOL, courseId: COURSE, status: 'accepted' },
    ])

    expect(await coursesOf(service)).toEqual([{ kind: 'course', id: COURSE }])
  })

  it('grants nothing for a place that has ended', async () => {
    const service = serviceOver([
      { studentId: STUDENT, schoolId: SCHOOL, courseId: COURSE, status: 'revoked' },
    ])

    expect(await service.scopesFor(STUDENT)).toEqual([{ kind: 'user', id: STUDENT }])
  })

  it('grants nothing for a row the student has put away', async () => {
    const service = serviceOver([
      {
        studentId: STUDENT,
        schoolId: SCHOOL,
        courseId: COURSE,
        status: 'revoked',
        archivedByStudentAt: WHEN_THE_STUDENT_TIDIED_UP,
      },
    ])

    expect(await service.scopesFor(STUDENT)).toEqual([{ kind: 'user', id: STUDENT }])
  })
})
