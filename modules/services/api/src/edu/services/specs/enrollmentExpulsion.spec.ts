import { ConflictException, INestApplication } from '@nestjs/common'
import { EnrollmentsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import { SyncScopesService } from '@vidya/api/sync'

import { createEnrollmentWorld, EnrollmentWorld, placeFor, reload } from './enrollmentWorld'

const WHEN_THE_SCHOOL_TIDIED_UP = new Date('2026-09-06T09:00:00.000Z')

/**
 * Expelling a student from a course: the school takes back a place it gave.
 *
 * Distinct from declining, which answers a request nobody has answered yet, and
 * from the student's own `withdrawn`. The console had no way to do it at all —
 * an accepted place was final — so a student admitted by mistake stayed.
 */
describe('a school expels an accepted student', () => {
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

  const expel = (enrollment: Awaited<ReturnType<typeof place>>) =>
    enrollments.moderate(enrollment, { status: 'revoked', decidedById: world.moderatorId })

  const courseScopes = async () =>
    (await app.get(SyncScopesService).scopesFor(world.studentId)).filter(
      (scope) => scope.kind === 'course',
    )

  it('ends the place', async () => {
    const held = await place('accepted', { groupId: world.groupId })

    const expelled = await expel(held)

    expect(expelled.status).toBe('revoked')
  })

  it('takes the group away, so the roster no longer carries them', async () => {
    const held = await place('accepted', { groupId: world.groupId })

    await expel(held)

    expect((await reload(app, held.id)).groupId).toBeNull()
  })

  it('takes the course off the student’s device with the place', async () => {
    const held = await place('accepted', { groupId: world.groupId })
    expect(await courseScopes()).toEqual([{ kind: 'course', id: world.courseId }])

    await expel(held)

    expect(await courseScopes()).toEqual([])
  })

  it('names who decided and when, like every other decision', async () => {
    const held = await place('accepted')

    const expelled = await expel(held)

    expect(expelled.decidedById).toBe(world.moderatorId)
    expect(expelled.decidedAt).toBeInstanceOf(Date)
  })

  it('brings the row back to the school’s own list', async () => {
    const held = await place('accepted', { archivedBySchoolAt: WHEN_THE_SCHOOL_TIDIED_UP })

    await expel(held)

    expect((await reload(app, held.id)).archivedBySchoolAt).toBeNull()
  })

  it('can be undone: the school puts the student back on the course', async () => {
    const held = await place('accepted', { groupId: world.groupId })
    const expelled = await expel(held)

    const restored = await enrollments.moderate(expelled, {
      status: 'accepted',
      groupId: world.groupId,
      decidedById: world.moderatorId,
    })

    expect(restored.status).toBe('accepted')
    expect(await courseScopes()).toEqual([{ kind: 'course', id: world.courseId }])
  })

  it('refuses to expel a request nobody has answered yet', async () => {
    const asked = await place('pending')

    await expect(expel(asked)).rejects.toThrow(ConflictException)
  })

  it('refuses to expel a place that has already ended', async () => {
    const gone = await place('withdrawn')

    await expect(expel(gone)).rejects.toThrow(ConflictException)
  })

  it('refuses to turn an accepted place into a refusal', async () => {
    const held = await place('accepted')

    await expect(
      enrollments.moderate(held, { status: 'declined', decidedById: world.moderatorId }),
    ).rejects.toThrow(ConflictException)
  })
})
