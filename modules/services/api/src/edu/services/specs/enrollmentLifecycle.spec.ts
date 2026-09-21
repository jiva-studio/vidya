import { ConflictException, INestApplication } from '@nestjs/common'
import { EnrollmentsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import { SyncScopesService } from '@vidya/api/sync'
import { DataSource } from 'typeorm'

import { createEnrollmentWorld, EnrollmentWorld, placeFor, reload } from './enrollmentWorld'

const A_WEEK_AGO = new Date('2026-09-01T09:00:00.000Z')
const WHEN_THE_STUDENT_TIDIED_UP = new Date('2026-09-05T09:00:00.000Z')
const WHEN_THE_SCHOOL_TIDIED_UP = new Date('2026-09-06T09:00:00.000Z')

describe('a place from decision to decision', () => {
  let app: INestApplication
  let world: EnrollmentWorld
  let enrollments: EnrollmentsService

  beforeEach(async () => {
    app = await createTestingApp()
    world = await createEnrollmentWorld(app)
    enrollments = app.get(EnrollmentsService)
  })

  afterEach(async () => {
    await app.close()
  })

  const place = (status: Parameters<typeof placeFor>[2], overrides = {}) =>
    placeFor(app, world, status, overrides)

  const revoke = () =>
    app
      .get(DataSource)
      .transaction((manager) =>
        enrollments.revokePlacesIn(world.studentId, world.schoolId, manager),
      )

  const courseScopes = async () =>
    (await app.get(SyncScopesService).scopesFor(world.studentId)).filter(
      (scope) => scope.kind === 'course',
    )

  /* -------------------------------------------------------------------------- */
  /*                      moderation out of a student's exit                    */
  /* -------------------------------------------------------------------------- */

  describe('a school takes back a student who left', () => {
    it('gives the place back, and the course scope with it', async () => {
      const left = await place('withdrawn')

      const restored = await enrollments.moderate(left, {
        status: 'accepted',
        decidedById: world.moderatorId,
      })

      expect(restored.status).toBe('accepted')
      expect(await courseScopes()).toEqual([{ kind: 'course', id: world.courseId }])
    })

    it('clears the stamp the student put on the row, so the news reaches them', async () => {
      const left = await place('withdrawn', {
        archivedByStudentAt: WHEN_THE_STUDENT_TIDIED_UP,
      })

      await enrollments.moderate(left, {
        status: 'accepted',
        decidedById: world.moderatorId,
      })

      expect((await reload(app, left.id)).archivedByStudentAt).toBeNull()
    })

    it('takes its own stamp off, so the row returns to the lists of the school', async () => {
      const left = await place('withdrawn', {
        archivedBySchoolAt: WHEN_THE_SCHOOL_TIDIED_UP,
        archivedBySchoolById: world.moderatorId,
      })

      await enrollments.moderate(left, {
        status: 'accepted',
        decidedById: world.moderatorId,
      })

      const row = await reload(app, left.id)

      expect(row.archivedBySchoolAt).toBeNull()
      expect(row.archivedBySchoolById).toBeNull()
    })

    it('refuses with a conflict while the student holds a live place on the course', async () => {
      // The partial index counts live rows, so accepting a finished one would
      // add a second and break it. Taken from `revoked`, which the school has
      // always been able to hand back, so the refusal cannot come from the
      // transition table.
      const taken = await place('revoked')
      await place('pending')

      await expect(
        enrollments.moderate(taken, { status: 'accepted', decidedById: world.moderatorId }),
      ).rejects.toBeInstanceOf(ConflictException)
    })

    it('leaves the finished row where it was when it refuses', async () => {
      const taken = await place('revoked')
      await place('pending')

      await enrollments
        .moderate(taken, { status: 'accepted', decidedById: world.moderatorId })
        .catch(() => undefined)

      expect((await reload(app, taken.id)).status).toBe('revoked')
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                         revocation, and rule R with it                     */
  /* -------------------------------------------------------------------------- */

  describe('a school takes a place back', () => {
    const accepted = () =>
      place('accepted', {
        groupId: world.groupId,
        decidedAt: A_WEEK_AGO,
        decidedById: world.moderatorId,
        archivedBySchoolAt: WHEN_THE_SCHOOL_TIDIED_UP,
        archivedBySchoolById: world.moderatorId,
        archivedByStudentAt: WHEN_THE_STUDENT_TIDIED_UP,
      })

    it('ends the place', async () => {
      const held = await accepted()

      await revoke()

      expect((await reload(app, held.id)).status).toBe('revoked')
    })

    it('takes the school stamp off, because being left is news to the school', async () => {
      const held = await accepted()

      await revoke()

      const row = await reload(app, held.id)

      expect(row.archivedBySchoolAt).toBeNull()
      expect(row.archivedBySchoolById).toBeNull()
    })

    it('clears the student stamp, so the row returns with its explanation', async () => {
      const held = await accepted()

      await revoke()

      expect((await reload(app, held.id)).archivedByStudentAt).toBeNull()
    })

    it('dates the decision, so a device that was away cannot write over it', async () => {
      const held = await accepted()

      await revoke()

      expect((await reload(app, held.id)).decidedAt.getTime()).toBeGreaterThan(A_WEEK_AGO.getTime())
    })

    it('empties the group, so whoever left is off its roll', async () => {
      const held = await accepted()

      await revoke()

      expect((await reload(app, held.id)).groupId).toBeNull()
    })

    it('leaves a finished place alone', async () => {
      const declined = await place('declined', {
        archivedBySchoolAt: WHEN_THE_SCHOOL_TIDIED_UP,
        archivedBySchoolById: world.moderatorId,
      })

      await revoke()

      const row = await reload(app, declined.id)

      expect(row.status).toBe('declined')
      expect(row.archivedBySchoolAt).not.toBeNull()
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                        the stamp across three decisions                    */
  /* -------------------------------------------------------------------------- */

  describe('a row the student put away comes back with every new decision', () => {
    it('survives leaving, being taken back, and then being revoked', async () => {
      // The hole this defends: the student leaves and the row is stamped, the
      // school hands the place back, and then takes it away. Without the stamp
      // being cleared by that last decision the access goes without a word.
      const left = await place('withdrawn', {
        archivedByStudentAt: WHEN_THE_STUDENT_TIDIED_UP,
      })

      await enrollments.moderate(left, {
        status: 'accepted',
        groupId: world.groupId,
        decidedById: world.moderatorId,
      })

      await revoke()

      const row = await reload(app, left.id)

      expect(row.status).toBe('revoked')
      expect(row.archivedByStudentAt).toBeNull()
    })

    it('comes back a second time when the same outcome repeats', async () => {
      const taken = await place('revoked', {
        archivedByStudentAt: WHEN_THE_STUDENT_TIDIED_UP,
      })

      await enrollments.moderate(taken, {
        status: 'accepted',
        decidedById: world.moderatorId,
      })

      await revoke()

      const row = await reload(app, taken.id)

      expect(row.status).toBe('revoked')
      expect(row.archivedByStudentAt).toBeNull()
    })
  })
})
