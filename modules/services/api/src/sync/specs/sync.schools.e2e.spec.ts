import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { AuthService } from '@vidya/api/auth/services'
import {
  CoursesService,
  EnrollmentsService,
  LessonsService,
  LessonVersionsService,
  UserSchoolsService,
  UsersService,
} from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import { SyncScopesService } from '@vidya/api/sync'
import * as domain from '@vidya/domain'
import { Course, Enrollment, Role, School, User } from '@vidya/entities'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

import { createSyncContext, journalRows, SECTION_ID, SyncContext } from './context'

const routes = protocol.Routes().sync
const DEVICE = 'device-8f2a6c14'

const LOGO_URL = 'https://cdn.example.org/logos/devotion.png'
const SCHOOL_DESCRIPTION = 'Scripture, kirtan and practice.'
const CATALOGUE_DESCRIPTION = 'Eighteen chapters, read and discussed.'

describe('the school scope', () => {
  let app: INestApplication
  let ds: DataSource
  let ctx: SyncContext

  /** Holds a role in the school and a place on nothing. */
  let member: { id: domain.UserId }
  let memberToken: string

  /** A course of the school nobody in this suite is enrolled on. */
  let catalogue: Course

  beforeEach(async () => {
    app = await createTestingApp()
    ds = app.get(DataSource)
    ctx = await createSyncContext(app)

    member = await app.get(UsersService).create({ email: faker.internet.email() })
    memberToken = (await app.get(AuthService).generateTokens(member.id, [])).accessToken

    catalogue = await app.get(CoursesService).create({
      name: 'Bhagavad-gita, chapter by chapter',
      description: CATALOGUE_DESCRIPTION,
      learningType: 'individual',
      schoolId: ctx.schoolId,
    })

    const lesson = await app.get(LessonsService).create({
      courseId: catalogue.id,
      schoolId: ctx.schoolId,
      lessonNumber: 1,
      title: 'The first chapter',
    })

    await app.get(LessonVersionsService).create({
      lessonId: lesson.id,
      version: 1,
      status: 'published',
      publishedAt: new Date(),
      content: {
        schemaVersion: domain.LessonContentSchemaVersion,
        sections: [
          {
            id: SECTION_ID,
            title: 'The first chapter',
            assessment: 'teacher',
            blocks: [
              {
                id: domain.asId<domain.BlockId>(faker.string.uuid()),
                type: 'text',
                content: 'Read this',
              },
            ],
          },
        ],
      },
    })
  })

  afterEach(async () => {
    await app.close()
  })

  const pull = (token: string, body: Partial<protocol.PullRequest> = {}) =>
    request(app.getHttpServer())
      .post(routes.pull())
      .auth(token, { type: 'bearer' })
      .send({ deviceId: DEVICE, cursors: {}, limit: protocol.SYNC_MAX_PULL_LIMIT, ...body })

  const grantRole = async (
    userId: domain.UserId,
    schoolId: domain.SchoolId,
  ): Promise<domain.RoleId> => {
    const role = await ds.getRepository(Role).save({
      name: faker.person.jobTitle(),
      description: 'A place in the school',
      schoolId,
      permissions: [],
    })

    await ds.createQueryBuilder().relation(User, 'roles').of(userId).add(role.id)

    return role.id
  }

  // Granting is fixture work and goes straight at the join table; taking a role
  // back is the behaviour under test and must go through the school's own path.
  const leaveSchool = (userId: domain.UserId): Promise<void> =>
    app.get(UserSchoolsService).removeUser(userId, ctx.schoolId)

  const placeOn = (
    courseId: domain.CourseId,
    studentId: domain.UserId,
    status: domain.EnrollmentStatus,
  ) => app.get(EnrollmentsService).create({ courseId, studentId, schoolId: ctx.schoolId, status })

  const placeNow = async (id: domain.EnrollmentId): Promise<domain.EnrollmentStatus> =>
    (await ds.getRepository(Enrollment).findOneBy({ id })).status

  const journalledEnrollments = async (): Promise<Record<string, unknown>[]> =>
    (await journalRows(ds)).filter((row) => row.collection === 'enrollments')

  const scopeKeys = (body: protocol.PullResponse): string[] =>
    body.scopes.map((grant) => domain.syncScopeKey(grant.scope))

  const collected = (body: protocol.PullResponse, collection: domain.SyncCollection) =>
    body.changes.filter((change) => change.collection === collection)

  // A pull hands down history, not a snapshot: a document written twice arrives
  // twice, oldest first, and only the last row says where it stands.
  const latest = (changes: readonly protocol.SyncChange[], docId: string): protocol.SyncChange =>
    changes.filter((change) => change.docId === docId).pop()

  /* ------------------------------- ------------------------------- */

  describe('what a student is entitled to read', () => {
    const scopes = () => app.get(SyncScopesService)

    it('grants the school a role names, with no place on any of its courses', async () => {
      await grantRole(member.id, ctx.schoolId)

      expect(await scopes().scopesFor(member.id)).toContainEqual({
        kind: 'school',
        id: ctx.schoolId,
      })
    })

    it('grants the school of an accepted place to a student who holds no role', async () => {
      expect(await scopes().scopesFor(ctx.student.id)).toContainEqual({
        kind: 'school',
        id: ctx.schoolId,
      })
    })

    it('names one school once when a role and an accepted place point at it', async () => {
      await grantRole(ctx.student.id, ctx.schoolId)

      const granted = await scopes().scopesFor(ctx.student.id)
      const schools = granted.filter((scope) => scope.kind === 'school')

      expect(schools).toEqual([{ kind: 'school', id: ctx.schoolId }])
    })

    it('grants nothing for a place that is still pending', async () => {
      const granted = await scopes().scopesFor(ctx.pending.id)

      expect(granted.filter((scope) => scope.kind === 'school')).toEqual([])
      expect(granted.filter((scope) => scope.kind === 'course')).toEqual([])
    })
  })

  /* ------------------------------- ------------------------------- */

  describe('where the journal addresses a row', () => {
    it('sends a course to its school and writes nothing about it to the course', async () => {
      const rows = await journalRows(ds)
      const courses = rows.filter((row) => row.collection === 'courses')

      expect(courses.length).toBeGreaterThan(0)
      expect(courses.map((row) => row.scope_kind)).toEqual(courses.map(() => 'school'))
      expect(new Set(courses.map((row) => row.scope_id))).toEqual(new Set([ctx.schoolId]))
    })

    it('keeps lessons, versions and their sections addressed to the course', async () => {
      const rows = await journalRows(ds)
      const content = rows.filter(
        (row) => row.collection === 'lessons' || row.collection === 'lesson_versions',
      )

      expect(content.length).toBeGreaterThan(0)
      expect(content.map((row) => row.scope_kind)).toEqual(content.map(() => 'course'))
      expect(content.some((row) => row.scope_id === ctx.schoolId)).toBe(false)
    })
  })

  /* ------------------------------- ------------------------------- */

  describe('a member of the school who is enrolled on nothing', () => {
    beforeEach(async () => {
      await grantRole(member.id, ctx.schoolId)
    })

    it('reads the catalogue card of a course it has no place on', async () => {
      const body = (await pull(memberToken).expect(200)).body as protocol.PullResponse

      const card = collected(body, 'courses').find((change) => change.docId === catalogue.id)

      expect(card).toBeDefined()
      expect(card.scope).toEqual({ kind: 'school', id: ctx.schoolId })
      expect(card.data).toMatchObject({
        name: 'Bhagavad-gita, chapter by chapter',
        description: CATALOGUE_DESCRIPTION,
        learningType: 'individual',
      })
    })

    it('reads not one lesson, version or section of a course it has no place on', async () => {
      const body = (await pull(memberToken).expect(200)).body as protocol.PullResponse

      expect(collected(body, 'lessons')).toEqual([])
      expect(collected(body, 'lesson_versions')).toEqual([])

      // A section rides inside a version's content, so the payloads are read
      // whole rather than by collection name.
      expect(JSON.stringify(body.changes)).not.toContain(SECTION_ID)

      expect(scopeKeys(body).filter((key) => key.startsWith('course:'))).toEqual([])
    })
  })

  /* ------------------------------- ------------------------------- */

  describe('the school itself on the wire', () => {
    it('travels as a row of its own scope, carrying its name, logo and description', async () => {
      await grantRole(member.id, ctx.schoolId)

      const schools = ds.getRepository(School)
      const school = await schools.findOneBy({ id: ctx.schoolId })

      Object.assign(school, { logoUrl: LOGO_URL, description: SCHOOL_DESCRIPTION })
      await schools.save(school)

      const body = (await pull(memberToken).expect(200)).body as protocol.PullResponse
      const rows = collected(body, 'schools')
      const latest = rows[rows.length - 1]

      expect(latest).toBeDefined()
      expect(latest.scope).toEqual({ kind: 'school', id: ctx.schoolId })
      expect(latest.data).toEqual({
        id: ctx.schoolId,
        name: school.name,
        logoUrl: LOGO_URL,
        description: SCHOOL_DESCRIPTION,
      })
    })
  })

  /* ------------------------------- ------------------------------- */

  describe('a role that is taken back', () => {
    beforeEach(async () => {
      await grantRole(ctx.student.id, ctx.schoolId)
    })

    it('takes back the accepted place the role carried', async () => {
      await leaveSchool(ctx.student.id)

      expect(await placeNow(ctx.enrollment.id)).toBe('revoked')
    })

    it('closes a request that was still open, leaving nothing pending in a school behind', async () => {
      const asked = await placeOn(catalogue.id, ctx.student.id, 'pending')

      await leaveSchool(ctx.student.id)

      expect(await placeNow(asked.id)).toBe('revoked')
    })

    it('leaves a refused request refused, a place never granted being nothing to take back', async () => {
      const refused = await placeOn(catalogue.id, ctx.student.id, 'declined')

      await leaveSchool(ctx.student.id)

      expect(await placeNow(refused.id)).toBe('declined')
    })

    /**
     * A bulk `UPDATE` would move the rows and reach no device: the journal is
     * written by an entity subscriber, and SQL that bypasses it changes the
     * table while the scope cursor walks past nothing.
     */
    it('journals each revocation to the student it belongs to', async () => {
      const before = (await journalledEnrollments()).length

      await leaveSchool(ctx.student.id)

      const written = (await journalledEnrollments()).slice(before)
      const revoked = written.filter(
        (row) => (row.data as { status?: string })?.status === 'revoked',
      )

      expect(revoked.map((row) => row.doc_id)).toEqual([ctx.enrollment.id])
      expect(revoked.map((row) => row.scope_kind)).toEqual(['user'])
      expect(revoked.map((row) => row.scope_id)).toEqual([ctx.student.id])
    })

    it('leaves the student nothing of the school, neither its scope nor its courses', async () => {
      await leaveSchool(ctx.student.id)

      const granted = await app.get(SyncScopesService).scopesFor(ctx.student.id)

      expect(granted.filter((scope) => scope.kind === 'school')).toEqual([])
      expect(granted.filter((scope) => scope.kind === 'course')).toEqual([])
    })

    it('closes the scope and leaves everything already handed down standing', async () => {
      await grantRole(member.id, ctx.schoolId)
      const key = domain.syncScopeKey({ kind: 'school', id: ctx.schoolId })

      const before = (await pull(memberToken).expect(200)).body as protocol.PullResponse

      expect(scopeKeys(before)).toContain(key)
      expect(collected(before, 'courses').length).toBeGreaterThan(0)

      const journalled = (await journalRows(ds)).length

      await leaveSchool(member.id)

      const after = (await pull(memberToken, { cursors: before.cursors }).expect(200))
        .body as protocol.PullResponse

      expect(scopeKeys(after)).not.toContain(key)
      expect(after.changes.filter((change) => change.scope.kind === 'school')).toEqual([])
      expect((await journalRows(ds)).length).toBe(journalled)
    })
  })

  /* ------------------------------- ------------------------------- */

  describe('a place taken back and a request refused', () => {
    it('reach the student as two different statuses', async () => {
      await grantRole(ctx.student.id, ctx.schoolId)
      const refused = await placeOn(catalogue.id, ctx.student.id, 'declined')

      await leaveSchool(ctx.student.id)

      const body = (await pull(ctx.tokens.student).expect(200)).body as protocol.PullResponse
      const places = collected(body, 'enrollments')

      expect(latest(places, ctx.enrollment.id).data.status).toBe('revoked')
      expect(latest(places, refused.id).data.status).toBe('declined')
    })
  })

  /* ------------------------------- ------------------------------- */

  describe('one place taken back, the role untouched', () => {
    it('keeps the school and drops only the course it was a place on', async () => {
      await grantRole(ctx.student.id, ctx.schoolId)

      await app
        .get(EnrollmentsService)
        .updateOneBy({ id: ctx.enrollment.id }, { status: 'revoked' })

      const granted = await app.get(SyncScopesService).scopesFor(ctx.student.id)

      expect(granted).toContainEqual({ kind: 'school', id: ctx.schoolId })
      expect(granted.filter((scope) => scope.kind === 'course')).toEqual([])
    })
  })

  /* ------------------------------- ------------------------------- */

  describe('a place that is not a role', () => {
    it('opens the school scope the moment a place is accepted', async () => {
      const outsider = await app.get(UsersService).create({ email: faker.internet.email() })
      const token = (await app.get(AuthService).generateTokens(outsider.id, [])).accessToken

      const before = (await pull(token).expect(200)).body as protocol.PullResponse

      expect(scopeKeys(before)).not.toContain(
        domain.syncScopeKey({ kind: 'school', id: ctx.schoolId }),
      )

      await app.get(EnrollmentsService).create({
        courseId: catalogue.id,
        studentId: outsider.id,
        schoolId: ctx.schoolId,
        status: 'accepted',
      })

      const after = (await pull(token).expect(200)).body as protocol.PullResponse

      expect(scopeKeys(after)).toContain(domain.syncScopeKey({ kind: 'school', id: ctx.schoolId }))
    })
  })
})
