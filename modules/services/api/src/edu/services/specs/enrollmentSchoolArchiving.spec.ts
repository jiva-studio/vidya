import { ConflictException, INestApplication } from '@nestjs/common'
import { EnrollmentsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'

import { createEnrollmentWorld, EnrollmentWorld, placeFor, reload } from './enrollmentWorld'

const WHEN_THE_STUDENT_TIDIED_UP = new Date('2026-09-05T09:00:00.000Z')

/**
 * The school may put a row away, and only a row that has an answer.
 *
 * A moderator hiding a live request would leave the student waiting on an
 * answer nobody is going to give.
 */
describe('a school tidies its own list', () => {
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

  it('refuses to put a request away while it is still waiting for an answer', async () => {
    const waiting = await place('pending')

    await expect(enrollments.archiveForSchool(waiting, world.moderatorId)).rejects.toBeInstanceOf(
      ConflictException,
    )
  })

  it('refuses to put away a student who is still studying', async () => {
    const studying = await place('accepted', { groupId: world.groupId })

    await expect(enrollments.archiveForSchool(studying, world.moderatorId)).rejects.toBeInstanceOf(
      ConflictException,
    )
  })

  it('puts a finished row away, naming who did it', async () => {
    const refused = await place('declined')

    await enrollments.archiveForSchool(refused, world.moderatorId)

    const row = await reload(app, refused.id)

    expect(row.archivedBySchoolAt).not.toBeNull()
    expect(row.archivedBySchoolById).toBe(world.moderatorId)
  })

  it('leaves the stamp the student put on the row alone', async () => {
    const refused = await place('declined', { archivedByStudentAt: WHEN_THE_STUDENT_TIDIED_UP })

    await enrollments.archiveForSchool(refused, world.moderatorId)

    expect((await reload(app, refused.id)).archivedByStudentAt).toEqual(WHEN_THE_STUDENT_TIDIED_UP)
  })
})
