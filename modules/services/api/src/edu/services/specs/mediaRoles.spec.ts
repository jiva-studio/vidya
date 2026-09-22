import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { AuthUsersService } from '@vidya/api/auth/services'
import { UserAuthentication } from '@vidya/api/auth/utils'
import {
  RolesService,
  SchoolCreationService,
  SchoolsService,
  UsersService,
} from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
import { Role, School, User } from '@vidya/entities'
import { DataSource, EntityManager } from 'typeorm'

const TECHNICIAN_NAME = 'Technical Specialist'
const TECHNICIAN_DESCRIPTION = 'Keeps the school storage configured'

const TECHNICIAN_PERMISSIONS: domain.PermissionKey[] = [
  'storage:read',
  'storage:update',
  'media:read',
  'media:upload',
  'media:delete',
  'schools:read',
]

describe('school storage permissions', () => {
  let app: INestApplication
  let authUsersService: AuthUsersService
  let rolesService: RolesService
  let schoolCreationService: SchoolCreationService
  let schoolsService: SchoolsService
  let usersService: UsersService
  let dataSource: DataSource

  beforeEach(async () => {
    app = await createTestingApp()

    authUsersService = app.get(AuthUsersService)
    rolesService = app.get(RolesService)
    schoolCreationService = app.get(SchoolCreationService)
    schoolsService = app.get(SchoolsService)
    usersService = app.get(UsersService)
    dataSource = app.get(DataSource)
  })

  afterEach(async () => {
    await app.close()
  })

  const authenticate = async (user: User): Promise<UserAuthentication> =>
    new UserAuthentication({
      sub: user.id,
      typ: 'access' as const,
      jti: faker.string.uuid(),
      exp: faker.date.future({ years: 1 }).getTime(),
      iat: Date.now(),
      permissions: await authUsersService.getUserPermissions(user.id),
    })

  const createUserWithRole = async (permissions: domain.PermissionKey[]): Promise<User> => {
    const school = await schoolsService.create({ name: faker.company.name() })
    const role = await rolesService.create({
      name: 'Role',
      description: 'A role',
      schoolId: school.id,
      permissions,
    })
    return usersService.create({ email: faker.internet.email(), roles: [role] })
  }

  const schoolOf = async (user: User): Promise<domain.SchoolId> => {
    const roles = await rolesService.getRolesOfUser(user.id)
    return roles[0].schoolId
  }

  /* -------------------------------------------------------------------------- */
  /*                          a role that grants it all                        */
  /* -------------------------------------------------------------------------- */

  describe('a role granted every permission', () => {
    it('may update the storage profile of its own school without its data being touched', async () => {
      const user = await createUserWithRole(['*'])
      const schoolId = await schoolOf(user)

      const auth = await authenticate(user)

      expect(auth.permissions.has(['storage:update'], { schoolId })).toBe(true)
      expect(auth.permissions.has(['storage:read'], { schoolId })).toBe(true)
    })
  })

  describe('a role granted the school presentation keys', () => {
    it('may not update the storage profile of that school', async () => {
      const user = await createUserWithRole(['schools:read', 'schools:update'])
      const schoolId = await schoolOf(user)

      const auth = await authenticate(user)

      expect(auth.permissions.has(['storage:update'], { schoolId })).toBe(false)
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                               createNewSchool                              */
  /* -------------------------------------------------------------------------- */

  describe('createNewSchool', () => {
    it('leaves the new school with an owner role and a technical role', async () => {
      const owner = await usersService.create({ email: faker.internet.email() })

      const school = await schoolCreationService.createNewSchool(owner.id, {
        name: 'Two Roles School',
      })

      const roles = await dataSource.getRepository(Role).findBy({ schoolId: school.id })

      expect(roles).toHaveLength(2)
      expect(roles.filter((role) => role.permissions.includes('*'))).toHaveLength(1)
    })

    it('gives the technical role the storage and media keys and nothing else', async () => {
      const owner = await usersService.create({ email: faker.internet.email() })

      const school = await schoolCreationService.createNewSchool(owner.id, {
        name: 'Technician School',
      })

      const roles = await dataSource.getRepository(Role).findBy({ schoolId: school.id })
      const technician = roles.find((role) => !role.permissions.includes('*'))

      expect(technician).toBeDefined()
      expect([...(technician?.permissions ?? [])].sort()).toEqual(
        [...TECHNICIAN_PERMISSIONS].sort(),
      )
    })

    it('calls the technical role by the name and description the product uses', async () => {
      const owner = await usersService.create({ email: faker.internet.email() })

      const school = await schoolCreationService.createNewSchool(owner.id, {
        name: 'Named Role School',
      })

      const roles = await dataSource.getRepository(Role).findBy({ schoolId: school.id })
      const technician = roles.find((role) => role.name === TECHNICIAN_NAME)

      expect(technician).toBeDefined()
      expect(technician?.description).toBe(TECHNICIAN_DESCRIPTION)
      expect([...(technician?.permissions ?? [])].sort()).toEqual(
        [...TECHNICIAN_PERMISSIONS].sort(),
      )
    })

    it('writes both roles on the same transaction as the school itself', async () => {
      const owner = await usersService.create({ email: faker.internet.email() })

      // The memory datasource does not honour ROLLBACK, so a rolled-back
      // insert cannot be observed as an absent row here; what is observable is
      // that every write went through one transactional manager.
      const saves = recordSaves()

      try {
        await schoolCreationService.createNewSchool(owner.id, { name: 'One Transaction School' })
      } finally {
        saves.restore()
      }

      const roleSaves = saves.calls.filter((call) => call.target === Role)
      const schoolSave = saves.calls.find((call) => call.target === School)

      expect(roleSaves.length).toBe(2)
      expect(schoolSave).toBeDefined()
      expect(roleSaves.every((call) => call.manager === schoolSave?.manager)).toBe(true)
      expect(roleSaves.some((call) => call.manager === dataSource.manager)).toBe(false)
    })
  })
})

type SaveCall = { target: unknown; manager: EntityManager }

/** Records what each `save` was aimed at and which manager carried it. */
const recordSaves = (): { calls: SaveCall[]; restore: () => void } => {
  const original = EntityManager.prototype.save
  const calls: SaveCall[] = []

  const spy = jest.spyOn(EntityManager.prototype, 'save').mockImplementation(function (
    this: EntityManager,
    ...args: unknown[]
  ) {
    calls.push({ target: args[0], manager: this })
    return (original as any).apply(this, args)
  } as any)

  return { calls, restore: () => spy.mockRestore() }
}
