import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import {
  CoursesService,
  EnrollmentsService,
  RolesService,
  UserSchoolsService,
  UsersService,
} from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
import { Enrollment, User } from '@vidya/entities'
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

  it('counts only the places the departure actually revoked', async () => {
    // A place in a school the caller holds no role in. It is reachable — the
    // enrolment is the student's own — and nothing about leaving takes it
    // away, so the answer must not claim it did.
    const outsider = ctx.misc.users.empty
    const course = await app.get(CoursesService).create({
      name: 'Bhagavad-gita',
      learningType: 'individual',
      schoolId: ctx.one.school.id,
    })

    const place = await app.get(EnrollmentsService).create({
      courseId: course.id,
      studentId: outsider.id,
      schoolId: ctx.one.school.id,
      status: 'accepted',
    })

    const response = await leave(
      outsider.id,
      ctx.one.school.id,
      await ctx.getAuthTokenFor(outsider),
    ).expect(200)

    const revoked = (await statusOf(place.id)) === 'revoked' ? 1 : 0

    expect(response.body.revokedPlaces).toBe(revoked)
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

/**
 * An owner does not leave on their own.
 *
 * A school without an owner is a school nobody can administer, and the route is
 * the one place a person takes themselves out. So the last word is not the
 * departing owner's: another owner takes the rights away first, through
 * ordinary role administration, and only then is there anyone left to leave.
 *
 * An owner is whoever holds the wildcard permission in that school — the role
 * `make bootstrap` creates — and not a flag of its own.
 */
describe('DELETE /edu/users/:userId/schools/:schoolId: an owner of the school', () => {
  let app: INestApplication
  let ctx: Context

  let owner: User
  let place: Enrollment

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)

    const course = await app.get(CoursesService).create({
      name: 'Bhakti-shastri',
      learningType: 'individual',
      schoolId: ctx.one.school.id,
    })

    owner = await makeOwner(app, ctx, 'Owner of One')

    place = await app.get(EnrollmentsService).create({
      courseId: course.id,
      studentId: owner.id,
      schoolId: ctx.one.school.id,
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

  const roleIdsIn = async (userId: domain.UserId, schoolId: domain.SchoolId) =>
    (await app.get(RolesService).getRolesOfUserWithin(userId, [schoolId]))
      .map((role) => role.id)
      .sort()

  it('refuses an owner who asks to leave', async () => {
    const response = await leave(
      owner.id,
      ctx.one.school.id,
      await ctx.getAuthTokenFor(owner),
    ).expect(409)

    // The refusal has to name the way out, because there is one and it is not
    // on this route: another owner takes the rights away first.
    expect(String(response.body.message)).toMatch(/owner/i)
  })

  it('leaves a refused owner holding every role they held', async () => {
    const before = await roleIdsIn(owner.id, ctx.one.school.id)

    await leave(owner.id, ctx.one.school.id, await ctx.getAuthTokenFor(owner)).expect(409)

    expect(await roleIdsIn(owner.id, ctx.one.school.id)).toEqual(before)
  })

  it('leaves a refused owner holding every place they held', async () => {
    await leave(owner.id, ctx.one.school.id, await ctx.getAuthTokenFor(owner)).expect(409)

    expect((await app.get(EnrollmentsService).findOneBy({ id: place.id })).status).toBe('accepted')
  })

  it('refuses one of two owners just the same', async () => {
    // A second owner does not turn the route into a way out: what changes the
    // situation is that other owner taking the rights away, which is role
    // administration and a path of its own.
    await makeOwner(app, ctx, 'Second Owner of One')

    await leave(owner.id, ctx.one.school.id, await ctx.getAuthTokenFor(owner)).expect(409)

    expect(await roleIdsIn(owner.id, ctx.one.school.id)).toHaveLength(1)
  })

  it('lets a member who is not an owner go, and takes their roles in that school with them', async () => {
    const member = ctx.misc.users.adminOfOneAndTwo

    await leave(member.id, ctx.one.school.id, await ctx.getAuthTokenFor(member)).expect(200)

    expect(await roleIdsIn(member.id, ctx.one.school.id)).toEqual([])
    expect(await roleIdsIn(member.id, ctx.two.school.id)).not.toEqual([])
  })
})

/** A user holding the wildcard permission in school one, as bootstrap writes it. */
const makeOwner = async (app: INestApplication, ctx: Context, name: string): Promise<User> => {
  const role = await app.get(RolesService).create({
    name,
    description: 'Owner of the school',
    schoolId: ctx.one.school.id,
    permissions: ['*'],
  })

  return app.get(UsersService).create({
    name,
    email: faker.internet.email(),
    roles: [role],
  })
}
