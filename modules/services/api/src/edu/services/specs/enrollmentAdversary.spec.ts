import {
  ConflictException,
  ForbiddenException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common'
import { UserAuthentication } from '@vidya/api/auth/utils'
import { EnrollmentsController, HomeworkController } from '@vidya/api/edu/controllers'
import {
  CoursesService,
  EnrollmentsService,
  GroupsService,
  HomeworkService,
  LessonsService,
  LessonVersionsService,
  SchoolsService,
  UsersService,
} from '@vidya/api/edu/services'
import { createTestingApp, newId } from '@vidya/api/edu/shared'
import { SyncScopesService } from '@vidya/api/sync'
import * as domain from '@vidya/domain'
import { emptyLessonContent } from '@vidya/domain'
import * as protocol from '@vidya/protocol'

import { createEnrollmentWorld, EnrollmentWorld, placeFor, reload } from './enrollmentWorld'

/** A school nobody in the tests below is granted anything in, with work to leak. */
type Rival = {
  schoolId: domain.SchoolId
  enrollmentId: domain.EnrollmentId
  homeworkId: domain.HomeworkId
}

const createRival = async (app: INestApplication): Promise<Rival> => {
  const school = await app.get(SchoolsService).create({ name: 'Rival school' })

  const course = await app.get(CoursesService).create({
    name: 'Vaishnava etiquette',
    learningType: 'group',
    schoolId: school.id,
  })

  const lesson = await app.get(LessonsService).create({
    courseId: course.id,
    schoolId: school.id,
    lessonNumber: 1,
    title: 'Introduction',
  })

  const version = await app.get(LessonVersionsService).create({
    lessonId: lesson.id,
    version: 1,
    status: 'published',
    publishedAt: new Date(),
    content: emptyLessonContent(),
  })

  const student = await app.get(UsersService).create({ email: 'rival.student@example.com' })

  const enrollment = await app.get(EnrollmentsService).create({
    courseId: course.id,
    studentId: student.id,
    schoolId: school.id,
    status: 'pending',
  })

  const work = await app.get(HomeworkService).create({
    enrollmentId: enrollment.id,
    lessonVersionId: version.id,
    sectionId: newId<domain.SectionId>(),
    schoolId: school.id,
    status: 'pending',
    text: 'The rival school’s answer',
    submittedAt: new Date(),
  })

  return { schoolId: school.id, enrollmentId: enrollment.id, homeworkId: work.id }
}

/**
 * The API under attack: what a caller can reach that their grants do not cover,
 * and what a sequence of decisions can do to a row that one cannot.
 */
describe('moderation under attack', () => {
  let app: INestApplication
  let world: EnrollmentWorld
  let rival: Rival
  let enrollmentsApi: EnrollmentsController
  let homeworkApi: HomeworkController

  beforeEach(async () => {
    app = await createTestingApp()
    world = await createEnrollmentWorld(app)
    rival = await createRival(app)
    enrollmentsApi = app.get(EnrollmentsController)
    homeworkApi = app.get(HomeworkController)
  })

  afterEach(async () => {
    await app.close()
  })

  const place = (status: Parameters<typeof placeFor>[2], overrides = {}) =>
    placeFor(app, world, status, overrides)

  const callerWith = (grants: protocol.UserPermission[]): UserAuthentication =>
    new UserAuthentication({
      sub: world.moderatorId,
      permissions: grants,
    } as protocol.AccessToken)

  const grantedIn = (
    schoolId: domain.SchoolId,
    ...permissions: domain.PermissionKey[]
  ): UserAuthentication => callerWith([{ sid: schoolId, p: permissions }])

  const courseScopes = async () =>
    (await app.get(SyncScopesService).scopesFor(world.studentId)).filter(
      (scope) => scope.kind === 'course',
    )

  const decide = (
    id: domain.EnrollmentId,
    request: protocol.ModerateEnrollmentRequest,
    auth: UserAuthentication,
  ) => enrollmentsApi.moderate(id, request, auth)

  /* -------------------------------------------------------------------------- */
  /*                                  The scope                                 */
  /* -------------------------------------------------------------------------- */

  describe('a caller reaching outside their grants', () => {
    it('refuses every decision to a caller granted in no school at all', async () => {
      const asked = await place('pending')
      const nobody = callerWith([])

      for (const status of ['accepted', 'declined', 'revoked'] as const) {
        await expect(decide(asked.id, { status }, nobody)).rejects.toThrow(ForbiddenException)
      }

      expect((await reload(app, asked.id)).status).toBe('pending')
    })

    it('refuses a decision on another school’s enrollment', async () => {
      const auth = grantedIn(world.schoolId, 'enrollments:moderate')

      await expect(decide(rival.enrollmentId, { status: 'accepted' }, auth)).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('leaves the other school’s row exactly as it was', async () => {
      const auth = grantedIn(world.schoolId, 'enrollments:moderate')

      await expect(decide(rival.enrollmentId, { status: 'declined' }, auth)).rejects.toThrow(
        ForbiddenException,
      )

      const row = await reload(app, rival.enrollmentId)
      expect(row.status).toBe('pending')
      expect(row.decidedAt).toBeNull()
    })

    it('refuses a caller holding a different permission in the right school', async () => {
      const asked = await place('pending')
      const auth = grantedIn(world.schoolId, 'enrollments:read')

      await expect(decide(asked.id, { status: 'accepted' }, auth)).rejects.toThrow(
        ForbiddenException,
      )
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                          The schoolId query filter                         */
  /* -------------------------------------------------------------------------- */

  describe('the schoolId filter as a lever', () => {
    it('answers an enrollment list with nothing when the school asked for is not granted', async () => {
      await place('pending')
      const auth = grantedIn(world.schoolId, 'enrollments:read')

      const found = await enrollmentsApi.getMany({ schoolId: rival.schoolId }, auth)

      expect(found.items).toEqual([])
    })

    it('still answers an unfiltered enrollment list with the granted school only', async () => {
      const mine = await place('pending')
      const auth = grantedIn(world.schoolId, 'enrollments:read')

      const found = await enrollmentsApi.getMany({}, auth)

      expect(found.items.map((item) => item.id)).toEqual([mine.id])
    })

    it('answers a homework list with nothing when the school asked for is not granted', async () => {
      const auth = grantedIn(world.schoolId, 'homework:read')

      const found = await homeworkApi.getMany({ schoolId: rival.schoolId }, auth)

      expect(found.items).toEqual([])
    })

    it('never puts another school’s homework in an unfiltered list', async () => {
      const auth = grantedIn(world.schoolId, 'homework:read')

      const found = await homeworkApi.getMany({}, auth)

      expect(found.items.map((item) => item.id)).not.toContain(rival.homeworkId)
    })

    // The two lists above are only worth their assertions if the rows they must
    // not show are reachable at all, which is what these two establish.
    it('shows the same homework to a caller granted in the school that owns it', async () => {
      const auth = grantedIn(rival.schoolId, 'homework:read')

      const found = await homeworkApi.getMany({ schoolId: rival.schoolId }, auth)

      expect(found.items.map((item) => item.id)).toEqual([rival.homeworkId])
    })

    it('shows the same enrollment to a caller granted in the school that owns it', async () => {
      const auth = grantedIn(rival.schoolId, 'enrollments:read')

      const found = await enrollmentsApi.getMany({ schoolId: rival.schoolId }, auth)

      expect(found.items.map((item) => item.id)).toEqual([rival.enrollmentId])
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                              Repeated decisions                            */
  /* -------------------------------------------------------------------------- */

  describe('the same decision made twice', () => {
    const moderate = () => app.get(EnrollmentsService)

    it('refuses the second revocation', async () => {
      const held = await place('accepted', { groupId: world.groupId })
      await moderate().moderate(held, { status: 'revoked', decidedById: world.moderatorId })
      const once = await reload(app, held.id)

      await expect(
        moderate().moderate(once, { status: 'revoked', decidedById: world.moderatorId }),
      ).rejects.toThrow(ConflictException)
    })

    it('leaves the revoked row untouched by the refused second attempt', async () => {
      const held = await place('accepted', { groupId: world.groupId })
      await moderate().moderate(held, { status: 'revoked', decidedById: world.moderatorId })
      const once = await reload(app, held.id)

      await expect(
        moderate().moderate(once, { status: 'revoked', decidedById: world.moderatorId }),
      ).rejects.toThrow(ConflictException)

      const twice = await reload(app, held.id)
      expect(twice.status).toBe('revoked')
      expect(twice.decidedAt).toEqual(once.decidedAt)
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                             A group on an ending                           */
  /* -------------------------------------------------------------------------- */

  describe('a group named on a decision that ends the place', () => {
    it('refuses a revocation that names a group', async () => {
      const held = await place('accepted', { groupId: world.groupId })
      const auth = grantedIn(world.schoolId, 'enrollments:moderate')

      await expect(
        decide(held.id, { status: 'revoked', groupId: world.groupId }, auth),
      ).rejects.toThrow(ConflictException)
    })

    it('leaves the accepted place in its group after refusing', async () => {
      const held = await place('accepted', { groupId: world.groupId })
      const auth = grantedIn(world.schoolId, 'enrollments:moderate')

      await expect(
        decide(held.id, { status: 'revoked', groupId: world.groupId }, auth),
      ).rejects.toThrow(ConflictException)

      const row = await reload(app, held.id)
      expect(row.status).toBe('accepted')
      expect(row.groupId).toBe(world.groupId)
    })

    it('refuses a refusal that names a group, and leaves the request open', async () => {
      const asked = await place('pending')
      const auth = grantedIn(world.schoolId, 'enrollments:moderate')

      await expect(
        decide(asked.id, { status: 'declined', groupId: world.groupId }, auth),
      ).rejects.toThrow(ConflictException)

      const row = await reload(app, asked.id)
      expect(row.status).toBe('pending')
      expect(row.decidedAt).toBeNull()
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                                 Round trip                                 */
  /* -------------------------------------------------------------------------- */

  describe('accepting, revoking and accepting again', () => {
    it('puts the student back exactly where they were', async () => {
      const asked = await place('pending')
      const auth = grantedIn(world.schoolId, 'enrollments:moderate')

      await decide(asked.id, { status: 'accepted', groupId: world.groupId }, auth)
      const admitted = await reload(app, asked.id)

      await decide(asked.id, { status: 'revoked' }, auth)
      await decide(asked.id, { status: 'accepted', groupId: world.groupId }, auth)
      const restored = await reload(app, asked.id)

      expect(restored.status).toBe(admitted.status)
      expect(restored.groupId).toBe(admitted.groupId)
      expect(restored.decidedById).toBe(admitted.decidedById)
    })

    it('gives the course back to the student’s device', async () => {
      const asked = await place('pending')
      const auth = grantedIn(world.schoolId, 'enrollments:moderate')

      await decide(asked.id, { status: 'accepted', groupId: world.groupId }, auth)
      await decide(asked.id, { status: 'revoked' }, auth)
      await decide(asked.id, { status: 'accepted', groupId: world.groupId }, auth)

      expect(await courseScopes()).toEqual([{ kind: 'course', id: world.courseId }])
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                                 Boundaries                                 */
  /* -------------------------------------------------------------------------- */

  describe('decisions naming something that is not there', () => {
    it('reports an enrollment that does not exist', async () => {
      const auth = grantedIn(world.schoolId, 'enrollments:moderate')

      await expect(
        decide(newId<domain.EnrollmentId>(), { status: 'accepted' }, auth),
      ).rejects.toThrow(NotFoundException)
    })

    it('reports a group that does not exist', async () => {
      const asked = await place('pending')
      const auth = grantedIn(world.schoolId, 'enrollments:moderate')

      await expect(
        decide(asked.id, { status: 'accepted', groupId: newId<domain.GroupId>() }, auth),
      ).rejects.toThrow(NotFoundException)

      expect((await reload(app, asked.id)).status).toBe('pending')
    })

    it('refuses a group belonging to another course', async () => {
      const elsewhere = await app.get(GroupsService).create({
        courseId: world.otherCourseId,
        schoolId: world.schoolId,
        name: 'Evening',
      })
      const asked = await place('pending')
      const auth = grantedIn(world.schoolId, 'enrollments:moderate')

      await expect(
        decide(asked.id, { status: 'accepted', groupId: elsewhere.id }, auth),
      ).rejects.toThrow(ConflictException)

      expect((await reload(app, asked.id)).status).toBe('pending')
    })
  })
})
