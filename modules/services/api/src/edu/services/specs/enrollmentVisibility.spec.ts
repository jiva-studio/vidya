import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { Enrollment } from '@vidya/entities'
import { DataSource, FindOptionsWhere } from 'typeorm'

import { visibleToSchool, visibleToStudent } from '../enrollmentVisibility'
import { createEnrollmentWorld, EnrollmentWorld, placeFor } from './enrollmentWorld'

const WHEN_THE_STUDENT_TIDIED_UP = new Date('2026-09-05T09:00:00.000Z')
const WHEN_THE_SCHOOL_TIDIED_UP = new Date('2026-09-06T09:00:00.000Z')

/**
 * The predicate as the database runs it, not as a function over rows.
 *
 * Running it through the repository is the only way to find out whether what
 * the rule composes is a query the database accepts. Either shape a rule can
 * take is read the same way here: a list of conditions is the OR of them.
 */
describe('which places each side is shown', () => {
  let app: INestApplication
  let world: EnrollmentWorld

  beforeEach(async () => {
    app = await createTestingApp()
    world = await createEnrollmentWorld(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const place = (status: Parameters<typeof placeFor>[2], overrides = {}) =>
    placeFor(app, world, status, overrides)

  const found = async (
    predicate: FindOptionsWhere<Enrollment> | FindOptionsWhere<Enrollment>[],
  ): Promise<string[]> => {
    const mine = { studentId: world.studentId }
    const where = Array.isArray(predicate)
      ? predicate.map((condition) => ({ ...mine, ...condition }))
      : { ...mine, ...predicate }

    const rows = await app.get(DataSource).getRepository(Enrollment).find({ where })

    return rows.map((row) => row.id)
  }

  describe('the list a student sees', () => {
    it('hides a finished row the student put away', async () => {
      const tidied = await place('declined', {
        archivedByStudentAt: WHEN_THE_STUDENT_TIDIED_UP,
      })

      expect(await found(visibleToStudent())).not.toContain(tidied.id)
    })

    it('shows a finished row nobody put away', async () => {
      const refused = await place('declined')

      expect(await found(visibleToStudent())).toContain(refused.id)
    })

    it('shows a live row even if a stamp somehow landed on it', async () => {
      // The server forbids that stamp; the branch is here because a row hidden
      // while the student is still studying cannot be brought back from a phone.
      const studying = await place('accepted', {
        archivedByStudentAt: WHEN_THE_STUDENT_TIDIED_UP,
      })

      expect(await found(visibleToStudent())).toContain(studying.id)
    })

    it('shows a row the school put away, because that is the school tidying up', async () => {
      const closed = await place('revoked', {
        archivedBySchoolAt: WHEN_THE_SCHOOL_TIDIED_UP,
        archivedBySchoolById: world.moderatorId,
      })

      expect(await found(visibleToStudent())).toContain(closed.id)
    })
  })

  describe('the list a school sees', () => {
    it('hides a row the school put away', async () => {
      const closed = await place('revoked', {
        archivedBySchoolAt: WHEN_THE_SCHOOL_TIDIED_UP,
        archivedBySchoolById: world.moderatorId,
      })

      expect(await found(visibleToSchool())).not.toContain(closed.id)
    })

    it('shows a row the student put away, because that is the student tidying up', async () => {
      const tidied = await place('declined', {
        archivedByStudentAt: WHEN_THE_STUDENT_TIDIED_UP,
      })

      expect(await found(visibleToSchool())).toContain(tidied.id)
    })
  })
})
