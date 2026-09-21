import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { AuthService } from '@vidya/api/auth/services'
import { CoursesService, UsersService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
import { Role, User } from '@vidya/entities'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

import { createSyncContext, SyncContext } from './context'

const routes = protocol.Routes().sync
const DEVICE = 'device-5a71d0e3'

/**
 * Publication on its way to a device.
 *
 * The card of a course rides the school scope, so the reader here is a member
 * who holds no place; the last case is the opposite reader — a student whose
 * place is accepted — because taking a course out of the catalogue must not
 * take the lessons away from the people already on it.
 */
describe('a course going in and out of the catalogue', () => {
  let app: INestApplication
  let ds: DataSource
  let ctx: SyncContext

  /** Holds a role in the school and a place on nothing. */
  let member: { id: domain.UserId }
  let memberToken: string

  beforeEach(async () => {
    app = await createTestingApp()
    ds = app.get(DataSource)
    ctx = await createSyncContext(app)

    member = await app.get(UsersService).create({ email: faker.internet.email() })
    memberToken = (await app.get(AuthService).generateTokens(member.id, [])).accessToken

    const role = await ds.getRepository(Role).save({
      name: faker.person.jobTitle(),
      description: 'A place in the school',
      schoolId: ctx.schoolId,
      permissions: [],
    })

    await ds.createQueryBuilder().relation(User, 'roles').of(member.id).add(role.id)
  })

  afterEach(async () => {
    await app.close()
  })

  const pull = (token: string) =>
    request(app.getHttpServer())
      .post(routes.pull())
      .auth(token, { type: 'bearer' })
      .send({ deviceId: DEVICE, cursors: {}, limit: protocol.SYNC_MAX_PULL_LIMIT })

  const changesSentTo = async (
    token: string,
    collection: domain.SyncCollection,
  ): Promise<protocol.SyncChange[]> => {
    const body = (await pull(token).expect(200)).body as protocol.PullResponse

    return body.changes.filter((change) => change.collection === collection)
  }

  const latest = (changes: readonly protocol.SyncChange[], docId: string) =>
    changes.filter((change) => change.docId === docId).pop()

  const setStatus = (id: domain.CourseId, status: domain.CourseStatus) =>
    app.get(CoursesService).updateOneBy({ id }, { status })

  it('carries the status of a course in the row a device receives', async () => {
    await setStatus(ctx.mine.course.id, 'published')

    const sent = await changesSentTo(memberToken, 'courses')

    expect(latest(sent, ctx.mine.course.id).data).toMatchObject({
      name: ctx.mine.course.name,
      status: 'published',
    })
  })

  it('sends a draft as a change rather than letting it fall silent', async () => {
    // A projection that journalled only the published ones would swallow the
    // event whole, and the course would sit in a device's catalogue for ever.
    await setStatus(ctx.mine.course.id, 'published')
    await setStatus(ctx.mine.course.id, 'draft')

    const sent = await changesSentTo(memberToken, 'courses')

    expect(latest(sent, ctx.mine.course.id).op).toBe('upsert')
    expect(latest(sent, ctx.mine.course.id).data).toMatchObject({ status: 'draft' })
  })

  it('keeps sending an accepted student the lessons of a course taken out of the catalogue', async () => {
    await setStatus(ctx.mine.course.id, 'published')
    await setStatus(ctx.mine.course.id, 'draft')

    const versions = await changesSentTo(ctx.tokens.student, 'lesson_versions')

    expect(latest(versions, ctx.mine.published.id)).toBeDefined()
    expect(latest(versions, ctx.mine.published.id).op).toBe('upsert')
  })

  it('does not revoke the place of a student on a course taken out of the catalogue', async () => {
    await setStatus(ctx.mine.course.id, 'published')
    await setStatus(ctx.mine.course.id, 'draft')

    const sent = await changesSentTo(ctx.tokens.student, 'enrollments')

    expect(latest(sent, ctx.enrollment.id).data).toMatchObject({ status: 'accepted' })
  })
})
