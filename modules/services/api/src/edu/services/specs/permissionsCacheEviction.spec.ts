import { INestApplication } from '@nestjs/common'
import {
  RolesService,
  SchoolCreationService,
  SchoolsService,
  UsersService,
} from '@vidya/api/edu/services'
import { createTestingApp, TestingOverride } from '@vidya/api/edu/shared'
import { RedisService } from '@vidya/api/shared/services'
import * as domain from '@vidya/domain'
import { UserPermissionsStorageKey } from '@vidya/protocol'
import { EntityManager } from 'typeorm'

/**
 * Redis with real semantics, so eviction is checked against what is actually
 * left in the store rather than against which methods were called — the same
 * shape `OtpService`'s and the auth controller specs' fakes use.
 */
class FakeRedis {
  readonly store = new Map<string, string>()

  async get(key: string): Promise<string | null> {
    return this.store.has(key) ? this.store.get(key) : null
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key)
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }
}

/**
 * These four writers are the ones described in the fix for the permissions
 * cache that is never invalidated: `RolesService.setRolesForUser`,
 * `.deleteOneBy`, `.updateOneBy`, and `SchoolCreationService.createNewSchool`.
 * Every entry here is seeded directly rather than warmed through
 * `AuthUsersService.getUserPermissions` — the cache TTL is 0 in this
 * environment by design, so warming it for real would test the TTL guard
 * rather than the eviction this suite is about.
 */
describe('permissions cache eviction', () => {
  let app: INestApplication
  let redis: FakeRedis
  let rolesService: RolesService
  let schoolCreationService: SchoolCreationService
  let schoolsService: SchoolsService
  let usersService: UsersService

  beforeEach(async () => {
    redis = new FakeRedis()
    const overrides: TestingOverride[] = [{ provide: RedisService, useValue: redis }]
    app = await createTestingApp(overrides)

    rolesService = app.get(RolesService)
    schoolCreationService = app.get(SchoolCreationService)
    schoolsService = app.get(SchoolsService)
    usersService = app.get(UsersService)
  })

  afterEach(async () => {
    await app.close()
  })

  const seedCache = async (userId: domain.UserId): Promise<string> => {
    const key = UserPermissionsStorageKey(userId)
    await redis.set(key, JSON.stringify([{ schoolId: 'stale', permissions: ['*'] }]))
    return key
  }

  const createSchoolAndRole = async (permissions: domain.PermissionKey[] = []) => {
    const school = await schoolsService.create({ name: 'Test School' })
    const role = await rolesService.create({
      name: 'Role',
      description: 'A role',
      schoolId: school.id,
      permissions,
    })
    return { school, role }
  }

  /* -------------------------------------------------------------------------- */
  /*                               setRolesForUser                              */
  /* -------------------------------------------------------------------------- */

  describe('setRolesForUser', () => {
    it('evicts the cache for the user a role is assigned to', async () => {
      const { role } = await createSchoolAndRole()
      const user = await usersService.create({ email: 'assign@example.com' })
      const key = await seedCache(user.id)

      await rolesService.setRolesForUser(user.id, [role.id])

      expect(await redis.get(key)).toBeNull()
    })

    it('evicts the cache for the user a role is removed from', async () => {
      const { role } = await createSchoolAndRole()
      const user = await usersService.create({ email: 'remove@example.com', roles: [role] })
      const key = await seedCache(user.id)

      await rolesService.setRolesForUser(user.id, [])

      expect(await redis.get(key)).toBeNull()
    })

    it('leaves the cache alone when the role set does not change', async () => {
      const { role } = await createSchoolAndRole()
      const user = await usersService.create({ email: 'noop@example.com', roles: [role] })
      const key = await seedCache(user.id)

      await rolesService.setRolesForUser(user.id, [role.id])

      expect(await redis.get(key)).not.toBeNull()
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                                 deleteOneBy                                */
  /* -------------------------------------------------------------------------- */

  describe('deleteOneBy', () => {
    it('evicts the cache for every holder of the deleted role', async () => {
      const { role } = await createSchoolAndRole()
      const holderA = await usersService.create({ email: 'holderA@example.com', roles: [role] })
      const holderB = await usersService.create({ email: 'holderB@example.com', roles: [role] })
      const keyA = await seedCache(holderA.id)
      const keyB = await seedCache(holderB.id)

      await rolesService.deleteOneBy({ id: role.id })

      expect(await redis.get(keyA)).toBeNull()
      expect(await redis.get(keyB)).toBeNull()
    })

    it('does not evict a holder when the delete rolls back', async () => {
      const { role } = await createSchoolAndRole()
      const holder = await usersService.create({ email: 'rollback@example.com', roles: [role] })
      const key = await seedCache(holder.id)

      // Simulates a failure between finding the role's holders and committing
      // its removal — the point every writer in this file positions its
      // eviction after, so this proves a throw there really does skip it.
      const removeSpy = jest.spyOn(EntityManager.prototype, 'remove').mockImplementationOnce(() => {
        throw new Error('simulated failure')
      })

      try {
        await expect(rolesService.deleteOneBy({ id: role.id })).rejects.toThrow('simulated failure')
      } finally {
        removeSpy.mockRestore()
      }

      // The role was never actually deleted...
      await expect(rolesService.findOneBy({ id: role.id })).resolves.not.toBeNull()

      // ...so the holder never actually lost the permissions the cache says
      // they have, and the entry survives untouched.
      expect(await redis.get(key)).not.toBeNull()
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                                 updateOneBy                                */
  /* -------------------------------------------------------------------------- */

  describe('updateOneBy', () => {
    it('evicts the cache for every holder when a role’s permissions change', async () => {
      const { role } = await createSchoolAndRole(['schools:read'])
      const holderA = await usersService.create({ email: 'updateA@example.com', roles: [role] })
      const holderB = await usersService.create({ email: 'updateB@example.com', roles: [role] })
      const keyA = await seedCache(holderA.id)
      const keyB = await seedCache(holderB.id)

      await rolesService.updateOneBy(
        { id: role.id },
        { permissions: ['schools:read', 'schools:update'] },
      )

      expect(await redis.get(keyA)).toBeNull()
      expect(await redis.get(keyB)).toBeNull()
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                               createNewSchool                              */
  /* -------------------------------------------------------------------------- */

  describe('createNewSchool', () => {
    it('evicts the cache for the new owner', async () => {
      const user = await usersService.create({ email: 'owner@example.com' })
      const key = await seedCache(user.id)

      await schoolCreationService.createNewSchool(user.id, { name: 'New School' })

      expect(await redis.get(key)).toBeNull()
    })
  })
})
