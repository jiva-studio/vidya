import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import {
  RolesService,
  SchoolCreationService,
  SchoolsService,
  UsersService,
} from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
import { AuditLog, Role } from '@vidya/entities'
import { DataSource } from 'typeorm'

const STORAGE_GRANTED = 'media.role.storageGranted'

// A storage profile's own audit payload may name the access key id and the
// tail of its secret; a role grant has no business carrying either.
const SECRET_SHAPED = /secret|password|credential|signature|bcdn_token|dek/i

describe('storage grant audit trail', () => {
  let app: INestApplication
  let rolesService: RolesService
  let schoolCreationService: SchoolCreationService
  let schoolsService: SchoolsService
  let usersService: UsersService
  let dataSource: DataSource

  beforeEach(async () => {
    app = await createTestingApp()

    rolesService = app.get(RolesService)
    schoolCreationService = app.get(SchoolCreationService)
    schoolsService = app.get(SchoolsService)
    usersService = app.get(UsersService)
    dataSource = app.get(DataSource)
  })

  afterEach(async () => {
    await app.close()
  })

  const storageGrants = async (): Promise<AuditLog[]> => {
    const rows = await dataSource.getRepository(AuditLog).find()
    return rows.filter((row) => (row.action as string) === STORAGE_GRANTED)
  }

  const createRole = async (permissions: domain.PermissionKey[], actorUserId: domain.UserId) => {
    const school = await schoolsService.create({ name: faker.company.name() })
    return rolesService.create(
      { name: 'Technician', description: 'A role', schoolId: school.id, permissions },
      actorUserId,
    )
  }

  const createActor = async () => usersService.create({ email: faker.internet.email() })

  it('records who granted a role the right to rewrite storage credentials', async () => {
    const actor = await createActor()

    const role = await createRole(['storage:read', 'storage:update'], actor.id)

    const [entry, ...rest] = await storageGrants()

    expect(entry).toBeDefined()
    expect(rest).toHaveLength(0)
    expect(entry?.actorUserId).toBe(actor.id)
    expect(entry?.subjectType).toBe('role')
    expect(entry?.subjectId).toBe(role.id)
    expect(entry?.schoolId).toBe(role.schoolId)
  })

  it('records the grant when an existing role gains the storage key', async () => {
    const actor = await createActor()
    const role = await createRole(['media:read'], actor.id)

    await rolesService.updateOneBy(
      { id: role.id },
      { permissions: ['media:read', 'storage:update'] },
      actor.id,
    )

    const grants = await storageGrants()

    expect(grants).toHaveLength(1)
    expect(grants[0]?.subjectId).toBe(role.id)
  })

  it('records nothing when a role is granted no storage key at all', async () => {
    const actor = await createActor()

    await createRole(['media:read', 'media:upload', 'media:delete'], actor.id)

    expect(await storageGrants()).toHaveLength(0)
  })

  it('keeps every secret out of what it records about the grant', async () => {
    const actor = await createActor()

    await createRole(['storage:update'], actor.id)

    const [entry] = await storageGrants()

    expect(entry).toBeDefined()
    expect(JSON.stringify(entry?.payload ?? {})).not.toMatch(SECRET_SHAPED)
    expect(Object.keys(entry?.payload ?? {}).join(',')).not.toMatch(SECRET_SHAPED)
  })

  it('records the grant when a role is created with every permission at once', async () => {
    const actor = await createActor()

    const role = await createRole(['*'], actor.id)

    const [entry, ...rest] = await storageGrants()

    expect(entry).toBeDefined()
    expect(rest).toHaveLength(0)
    expect(entry?.actorUserId).toBe(actor.id)
    expect(entry?.subjectType).toBe('role')
    expect(entry?.subjectId).toBe(role.id)
    expect(entry?.schoolId).toBe(role.schoolId)
    expect(entry?.payload).toMatchObject({ granted: ['*'] })
  })

  it('records the grant when a role is widened to every permission at once', async () => {
    const actor = await createActor()
    const role = await createRole(['media:read'], actor.id)

    await rolesService.updateOneBy({ id: role.id }, { permissions: ['*'] }, actor.id)

    const grants = await storageGrants()

    expect(grants).toHaveLength(1)
    expect(grants[0]?.subjectId).toBe(role.id)
    expect(grants[0]?.payload).toMatchObject({ granted: ['*'] })
  })

  it('records no grant for the roles a new school is born with', async () => {
    const owner = await createActor()

    await schoolCreationService.createNewSchool(owner.id, { name: 'Born Roles School' })

    expect(await storageGrants()).toHaveLength(0)
  })

  it('names both of the new roles in the school creation entry', async () => {
    const owner = await createActor()

    const school = await schoolCreationService.createNewSchool(owner.id, {
      name: 'Named Roles School',
    })

    const roles = await dataSource.getRepository(Role).findBy({ schoolId: school.id })
    const ownerRole = roles.find((role) => role.permissions.includes('*'))
    const technicianRole = roles.find((role) => !role.permissions.includes('*'))

    const rows = await dataSource.getRepository(AuditLog).find()
    const entry = rows.find((row) => row.action === 'edu.school.created')

    // The trail is read by query, so the field names are part of the contract
    // and not only the ids behind them.
    const named = Object.values(entry?.payload ?? {}).filter((value) => typeof value === 'string')

    expect(ownerRole).toBeDefined()
    expect(technicianRole).toBeDefined()
    expect(entry?.payload).toMatchObject({
      ownerRoleId: ownerRole?.id,
      technicalRoleId: technicianRole?.id,
    })
    expect(named).toContain(ownerRole?.id)
    expect(named).toContain(technicianRole?.id)
  })
})
