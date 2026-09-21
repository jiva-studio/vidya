import { INestApplication } from '@nestjs/common'
import { EnrollmentsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { Context, createContext } from './context'

const routes = protocol.Routes().edu.enrollments

const PREFERRED_TIMES: domain.PreferredTimes = {
  timeZone: 'Asia/Kolkata',
  ranges: [{ days: ['sat', 'sun'], startMinute: 420, endMinute: 660 }],
}

const COMMENT = 'Evenings are hard, I work late.'

const WHEN_THE_SCHOOL_TIDIED_UP = new Date('2026-09-06T09:00:00.000Z')

/**
 * What a request says for itself, once it is read back over REST.
 *
 * The console shows the school its own time beside the student's, and it has
 * nothing to convert unless the ranges leave the database in the first place.
 */
describe('a request read back over REST', () => {
  let app: INestApplication
  let ctx: Context

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const place = (overrides: Record<string, unknown> = {}) =>
    app.get(EnrollmentsService).create({
      courseId: domain.asId<domain.CourseId>(ctx.courseId),
      studentId: domain.asId<domain.UserId>(ctx.studentId),
      schoolId: domain.asId<domain.SchoolId>(ctx.schoolId),
      status: 'pending',
      ...overrides,
    })

  const read = async (id: string, token: string): Promise<protocol.EnrollmentDetails> =>
    (
      await request(app.getHttpServer())
        .get(routes.get(id))
        .auth(token, { type: 'bearer' })
        .expect(200)
    ).body as protocol.EnrollmentDetails

  it('carries the times the student offered', async () => {
    const asked = await place({ preferredTimes: PREFERRED_TIMES })

    expect((await read(asked.id, ctx.tokens.moderator)).preferredTimes).toEqual(PREFERRED_TIMES)
  })

  it('carries the group the student asked for, beside the one they were given', async () => {
    const asked = await place({ preferredGroupId: ctx.groupId })

    const details = await read(asked.id, ctx.tokens.moderator)

    expect(details.preferredGroupId).toBe(ctx.groupId)
    expect(details.groupId).toBeUndefined()
  })

  it('carries what the student wrote', async () => {
    const asked = await place({ comment: COMMENT })

    expect((await read(asked.id, ctx.tokens.moderator)).comment).toBe(COMMENT)
  })

  it('tells the console when the school put the row away, and who did it', async () => {
    const closed = await place({
      status: 'declined',
      archivedBySchoolAt: WHEN_THE_SCHOOL_TIDIED_UP,
      archivedBySchoolById: domain.asId<domain.UserId>(ctx.studentId),
    })

    const details = await read(closed.id, ctx.tokens.moderator)

    expect(details.archivedBySchoolAt).toBe(WHEN_THE_SCHOOL_TIDIED_UP.toISOString())
    expect(details.archivedBySchoolById).toBe(ctx.studentId)
  })
})
