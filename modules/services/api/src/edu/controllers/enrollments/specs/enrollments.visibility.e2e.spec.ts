import { INestApplication } from '@nestjs/common'
import { EnrollmentsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
import { Enrollment } from '@vidya/entities'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

import { Context, createContext } from './context'

const routes = protocol.Routes().edu.enrollments

const WHEN_THE_STUDENT_TIDIED_UP = new Date('2026-09-05T09:00:00.000Z')
const WHEN_THE_SCHOOL_TIDIED_UP = new Date('2026-09-06T09:00:00.000Z')

/**
 * Each side tidies its own list, and neither tidies the other's.
 *
 * One route answers a student as well as staff, with a different rule for each.
 */
describe('what each side is shown by the enrollment lists', () => {
  let app: INestApplication
  let ctx: Context

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const place = (
    status: domain.EnrollmentStatus,
    overrides: Record<string, unknown> = {},
    courseId: string = ctx.courseId,
  ) =>
    app.get(EnrollmentsService).create({
      courseId: domain.asId<domain.CourseId>(courseId),
      studentId: domain.asId<domain.UserId>(ctx.studentId),
      schoolId: domain.asId<domain.SchoolId>(ctx.schoolId),
      status,
      ...overrides,
    })

  const items = (response: request.Response) =>
    (response.body as protocol.GetEnrollmentsResponse).items

  const many = (token: string, query = '') =>
    request(app.getHttpServer())
      .get(`${routes.find()}${query}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

  const ids = (response: request.Response) => items(response).map((item) => item.id)

  /* -------------------------------------------------------------------------- */
  /*                               GET /enrollments                             */
  /* -------------------------------------------------------------------------- */

  describe('getMany, asked by a student', () => {
    it('drops a finished row the student put away', async () => {
      const tidied = await place('declined', {
        archivedByStudentAt: WHEN_THE_STUDENT_TIDIED_UP,
      })

      expect(ids(await many(ctx.tokens.student))).not.toContain(tidied.id)
    })

    it('keeps a row the school put away', async () => {
      const closed = await place('revoked', {
        archivedBySchoolAt: WHEN_THE_SCHOOL_TIDIED_UP,
      })

      expect(ids(await many(ctx.tokens.student))).toContain(closed.id)
    })
  })

  describe('getMany, asked by staff', () => {
    it('drops a row the school put away', async () => {
      const closed = await place('revoked', {
        archivedBySchoolAt: WHEN_THE_SCHOOL_TIDIED_UP,
      })

      expect(ids(await many(ctx.tokens.observer))).not.toContain(closed.id)
    })

    it('keeps a row the student put away, because that was not the school tidying up', async () => {
      const tidied = await place('declined', {
        archivedByStudentAt: WHEN_THE_STUDENT_TIDIED_UP,
      })

      expect(ids(await many(ctx.tokens.observer))).toContain(tidied.id)
    })

    it('leaves whoever lost their place off the roll of the group', async () => {
      const held = await place('accepted', { groupId: ctx.groupId })

      await app
        .get(DataSource)
        .transaction((manager) =>
          app
            .get(EnrollmentsService)
            .revokePlacesIn(
              domain.asId<domain.UserId>(ctx.studentId),
              domain.asId<domain.SchoolId>(ctx.schoolId),
              manager,
            ),
        )

      const roll = await many(ctx.tokens.observer, `?groupId=${ctx.groupId}`)

      expect(ids(roll)).not.toContain(held.id)
      expect(
        (await app.get(DataSource).getRepository(Enrollment).findOneBy({ id: held.id })).groupId,
      ).toBeNull()
    })
  })
})
