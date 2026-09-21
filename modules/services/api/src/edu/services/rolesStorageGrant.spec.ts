import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { RolesService, SchoolsService, UsersService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
import { AuditLog } from '@vidya/entities'
import { DataSource } from 'typeorm'

describe('storage grants a role already holds', () => {
  let app: INestApplication
  let rolesService: RolesService
  let schoolsService: SchoolsService
  let usersService: UsersService
  let dataSource: DataSource

  beforeEach(async () => {
    app = await createTestingApp()

    rolesService = app.get(RolesService)
    schoolsService = app.get(SchoolsService)
    usersService = app.get(UsersService)
    dataSource = app.get(DataSource)
  })

  afterEach(async () => {
    await app.close()
  })

  const grants = async (): Promise<AuditLog[]> => {
    const rows = await dataSource.getRepository(AuditLog).find()
    return rows.filter((row) => (row.action as string) === 'media.role.storageGranted')
  }

  const countGrants = async (): Promise<number> => (await grants()).length

  const createRole = async (permissions: domain.PermissionKey[]) => {
    const school = await schoolsService.create({ name: faker.company.name() })
    const actor = await usersService.create({ email: faker.internet.email() })
    const role = await rolesService.create(
      { name: 'Technician', description: 'A role', schoolId: school.id, permissions },
      actor.id,
    )
    return { role, actor }
  }

  it('names the storage keys the role gained', async () => {
    const { role, actor } = await createRole(['media:read'])

    await rolesService.updateOneBy(
      { id: role.id },
      { permissions: ['media:read', 'storage:read', 'storage:update'] },
      actor.id,
    )

    const [entry] = await grants()

    expect(entry?.payload).toEqual({ granted: ['storage:read', 'storage:update'] })
  })

  it('records nothing a second time when the key it already had is kept', async () => {
    const { role, actor } = await createRole(['storage:update'])

    await rolesService.updateOneBy(
      { id: role.id },
      { permissions: ['storage:update', 'media:read'] },
      actor.id,
    )

    expect(await countGrants()).toBe(1)
  })

  it('records nothing when only the name of a storage role changes', async () => {
    const { role, actor } = await createRole(['storage:read'])

    await rolesService.updateOneBy({ id: role.id }, { name: 'Renamed' }, actor.id)

    expect(await countGrants()).toBe(1)
  })
})
