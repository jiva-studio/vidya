import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { AuthService } from '@vidya/api/auth/services'
import { GroupsService, UsersService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
import { Group, Role, User } from '@vidya/entities'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

import { createSyncContext, SyncContext } from './context'

const routes = protocol.Routes().sync
const DEVICE = 'device-3c9f1b20'

/**
 * The catalogue of groups, which is read by exactly the person who holds no
 * place yet: the groups ride the school scope, because the course scope is what
 * enrolling buys.
 */
describe('groups on their way to a device', () => {
  let app: INestApplication
  let ds: DataSource
  let ctx: SyncContext

  /** Holds a role in the school and a place on nothing. */
  let member: { id: domain.UserId }
  let memberToken: string

  /** Belongs to nothing at all. */
  let outsiderToken: string

  let morning: Group

  beforeEach(async () => {
    app = await createTestingApp()
    ds = app.get(DataSource)
    ctx = await createSyncContext(app)

    member = await app.get(UsersService).create({ email: faker.internet.email() })
    memberToken = (await app.get(AuthService).generateTokens(member.id, [])).accessToken

    const outsider = await app.get(UsersService).create({ email: faker.internet.email() })
    outsiderToken = (await app.get(AuthService).generateTokens(outsider.id, [])).accessToken

    // A group of the course this suite's member holds no place on.
    morning = await app.get(GroupsService).create({
      courseId: ctx.theirs.course.id,
      schoolId: ctx.schoolId,
      name: 'Morning',
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

  const grantRole = async (userId: domain.UserId): Promise<void> => {
    const role = await ds.getRepository(Role).save({
      name: faker.person.jobTitle(),
      description: 'A place in the school',
      schoolId: ctx.schoolId,
      permissions: [],
    })

    await ds.createQueryBuilder().relation(User, 'roles').of(userId).add(role.id)
  }

  const groupsSentTo = async (token: string): Promise<protocol.SyncChange[]> => {
    const body = (await pull(token).expect(200)).body as protocol.PullResponse

    return body.changes.filter((change) => change.collection === 'groups')
  }

  const latest = (changes: readonly protocol.SyncChange[], docId: string) =>
    changes.filter((change) => change.docId === docId).pop()

  it('sends a member the groups of a course they are not enrolled on', async () => {
    await grantRole(member.id)

    const sent = await groupsSentTo(memberToken)

    expect(latest(sent, morning.id)).toBeDefined()
    expect(latest(sent, morning.id).data).toMatchObject({
      courseId: ctx.theirs.course.id,
      name: 'Morning',
      status: 'pending',
    })
  })

  it('sends no group of the school to someone who belongs to neither', async () => {
    expect(await groupsSentTo(outsiderToken)).toEqual([])
  })

  it('sends a closed group as a change rather than letting it fall silent', async () => {
    // Journalling only the recruiting ones would make closing recruitment
    // produce no row at all, and the group would stay in the catalogue for ever.
    await grantRole(member.id)

    await app.get(GroupsService).updateOneBy({ id: morning.id }, { status: 'active' })

    const sent = await groupsSentTo(memberToken)

    expect(latest(sent, morning.id).op).toBe('upsert')
    expect(latest(sent, morning.id).data).toMatchObject({ status: 'active' })
  })
})
