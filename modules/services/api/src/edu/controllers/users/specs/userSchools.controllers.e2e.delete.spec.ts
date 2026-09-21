import { INestApplication } from '@nestjs/common'
import { CoursesService, EnrollmentsService, UserSchoolsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
import { Enrollment } from '@vidya/entities'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { Context, createContext } from './context'

/**
 * Leaving a school, which is leaving its courses.
 *
 * The user in these cases belongs to both schools and holds places in both, so
 * every case also says what leaving one does not touch.
 */
describe('DELETE /edu/users/:userId/schools/:schoolId', () => {
  let app: INestApplication
  let ctx: Context

  let placeInOne: Enrollment
  let requestInOne: Enrollment
  let placeInTwo: Enrollment

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)

    const courses = app.get(CoursesService)
    const enrollments = app.get(EnrollmentsService)
    const student = ctx.misc.users.adminOfOneAndTwo

    const attended = await courses.create({
      name: 'Bhakti-shastri',
      learningType: 'individual',
      schoolId: ctx.one.school.id,
    })

    const wanted = await courses.create({
      name: 'Sanskrit for beginners',
      learningType: 'individual',
      schoolId: ctx.one.school.id,
    })

    const elsewhere = await courses.create({
      name: 'Bhakti-vaibhava',
      learningType: 'individual',
      schoolId: ctx.two.school.id,
    })

    placeInOne = await enrollments.create({
      courseId: attended.id,
      studentId: student.id,
      schoolId: ctx.one.school.id,
      status: 'accepted',
    })

    requestInOne = await enrollments.create({
      courseId: wanted.id,
      studentId: student.id,
      schoolId: ctx.one.school.id,
      status: 'pending',
    })

    placeInTwo = await enrollments.create({
      courseId: elsewhere.id,
      studentId: student.id,
      schoolId: ctx.two.school.id,
      status: 'accepted',
    })
  })

  afterEach(async () => {
    await app.close()
  })

  const leave = (userId: string, schoolId: string, token: string) =>
    request(app.getHttpServer())
      .delete(protocol.Routes().edu.user(userId).schools.delete(schoolId))
      .set('Authorization', token)

  const statusOf = async (enrollmentId: domain.EnrollmentId) =>
    (await app.get(EnrollmentsService).findOneBy({ id: enrollmentId })).status

  it('refuses to take anyone but the caller out of a school', async () => {
    const token = await ctx.getAuthTokenFor(ctx.two.users.twoAdmin)

    return leave(ctx.misc.users.adminOfOneAndTwo.id, ctx.one.school.id, token).expect(403)
  })

  it('leaves the school out of the ones the caller belongs to afterwards', async () => {
    const student = ctx.misc.users.adminOfOneAndTwo

    await leave(student.id, ctx.one.school.id, await ctx.getAuthTokenFor(student)).expect(200)

    expect(await app.get(UserSchoolsService).getUserSchools(student.id)).not.toContain(
      ctx.one.school.id,
    )
  })

  it('revokes the places the school still held for the caller, granted and asked for alike', async () => {
    const student = ctx.misc.users.adminOfOneAndTwo

    await leave(student.id, ctx.one.school.id, await ctx.getAuthTokenFor(student)).expect(200)

    expect(await statusOf(placeInOne.id)).toBe('revoked')
    expect(await statusOf(requestInOne.id)).toBe('revoked')
  })

  it('answers with how many places the departure took with it', async () => {
    const student = ctx.misc.users.adminOfOneAndTwo

    const response = await leave(
      student.id,
      ctx.one.school.id,
      await ctx.getAuthTokenFor(student),
    ).expect(200)

    expect(response.body.revokedPlaces).toBe(2)
  })

  it('leaves the places held in another school alone', async () => {
    const student = ctx.misc.users.adminOfOneAndTwo

    await leave(student.id, ctx.one.school.id, await ctx.getAuthTokenFor(student)).expect(200)

    expect(await statusOf(placeInTwo.id)).toBe('accepted')
    expect(await app.get(UserSchoolsService).getUserSchools(student.id)).toContain(
      ctx.two.school.id,
    )
  })

  it('answers a caller who belongs to no such school with nothing revoked', async () => {
    const outsider = ctx.misc.users.empty

    const response = await leave(
      outsider.id,
      ctx.one.school.id,
      await ctx.getAuthTokenFor(outsider),
    ).expect(200)

    expect(response.body.revokedPlaces).toBe(0)
  })
})
