import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { AuthService } from '@vidya/api/auth/services'
import { RolesService, SchoolsService } from '@vidya/api/edu/services'
import { createTestingApp, newId } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
import { Role, School } from '@vidya/entities'
import { Routes } from '@vidya/protocol'
import * as request from 'supertest'

/**
 * A caller holding `roles:create`/`roles:update` may shape roles in a
 * school, but that must not let them grant a permission they do not
 * themselves hold there — otherwise `roles:create` plus one editable
 * permission is equivalent to holding every permission in the school.
 */
describe('/edu/roles permission-grant escalation', () => {
  let app: INestApplication
  let rolesService: RolesService
  let school: School

  const tokenWith = async (permissions: domain.PermissionKey[]): Promise<string> => {
    const authService = app.get(AuthService)
    const { accessToken } = await authService.generateTokens(newId<domain.UserId>(), [
      { sid: school.id, p: permissions },
    ])
    return accessToken
  }

  beforeEach(async () => {
    app = await createTestingApp()
    rolesService = app.get(RolesService)
    school = await app.get(SchoolsService).create({ name: faker.company.name() })
  })

  afterAll(async () => {
    await app.close()
  })

  /* -------------------------------------------------------------------------- */
  /*                                   Create                                   */
  /* -------------------------------------------------------------------------- */

  it(`POST /edu/roles returns 403 when the role carries a permission the caller does not hold`, async () => {
    const token = await tokenWith(['roles:create', 'users:update'])

    return request(app.getHttpServer())
      .post(Routes().edu.roles.create())
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New Role',
        description: 'Role description',
        permissions: ['users:read'],
        schoolId: school.id,
      })
      .expect(403)
      .expect((res) => {
        expect(res.body).toHaveProperty('message')
        expect(res.body.message).toBe('User does not have permission')
      })
  })

  it(`POST /edu/roles succeeds when the role only carries permissions the caller holds`, async () => {
    const token = await tokenWith(['roles:create', 'users:update'])

    return request(app.getHttpServer())
      .post(Routes().edu.roles.create())
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New Role',
        description: 'Role description',
        permissions: ['users:update'],
        schoolId: school.id,
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id')
      })
  })

  it(`POST /edu/roles lets an Owner (holding '*') grant any permission`, async () => {
    const token = await tokenWith(['*'])

    return request(app.getHttpServer())
      .post(Routes().edu.roles.create())
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New Role',
        description: 'Role description',
        permissions: ['users:read', 'schools:delete'],
        schoolId: school.id,
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id')
      })
  })

  /* -------------------------------------------------------------------------- */
  /*                                   Update                                   */
  /* -------------------------------------------------------------------------- */

  it(`PATCH /edu/roles/:id returns 403 when adding a permission the caller lacks, even while removing another`, async () => {
    const target: Role = await rolesService.create({
      name: 'Target Role',
      description: 'Role description',
      permissions: ['roles:read'],
      schoolId: school.id,
    })

    // Holds roles:update and roles:read, but not users:read.
    const token = await tokenWith(['roles:update', 'roles:read'])

    return request(app.getHttpServer())
      .patch(Routes().edu.roles.update(target.id))
      .set('Authorization', `Bearer ${token}`)
      .send({ permissions: ['roles:update', 'users:read'] })
      .expect(403)
      .expect((res) => {
        expect(res.body).toHaveProperty('message')
        expect(res.body.message).toBe('User does not have permission')
      })
  })

  it(`PATCH /edu/roles/:id succeeds when the new permission set is within what the caller holds`, async () => {
    const target: Role = await rolesService.create({
      name: 'Target Role',
      description: 'Role description',
      permissions: ['roles:read'],
      schoolId: school.id,
    })

    const token = await tokenWith(['roles:update', 'roles:read', 'users:update'])

    return request(app.getHttpServer())
      .patch(Routes().edu.roles.update(target.id))
      .set('Authorization', `Bearer ${token}`)
      .send({ permissions: ['users:update'] })
      .expect(200)
      .expect((res) => {
        expect(res.body.permissions).toStrictEqual(['users:update'])
      })
  })
})
