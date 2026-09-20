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
import { DataSource, EntityManager } from 'typeorm'

describe('edu audit trail', () => {
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

  const auditRows = async (): Promise<AuditLog[]> => dataSource.getRepository(AuditLog).find()

  const createSchoolAndRole = async (permissions: domain.PermissionKey[] = []): Promise<Role> => {
    const school = await schoolsService.create({ name: 'Test School' })
    return rolesService.create({
      name: 'Role',
      description: 'A role',
      schoolId: school.id,
      permissions,
    })
  }

  /* -------------------------------------------------------------------------- */
  /*                       setRolesForUser :: assignment                       */
  /* -------------------------------------------------------------------------- */

  describe('setRolesForUser', () => {
    it('names the actor, the subject and the role when a role is assigned', async () => {
      const role = await createSchoolAndRole()
      const actor = await usersService.create({ email: 'admin@example.com' })
      const subject = await usersService.create({ email: 'assignee@example.com' })

      await rolesService.setRolesForUser(subject.id, [role.id], actor.id)

      const rows = await auditRows()
      const entry = rows.find((row) => row.action === 'edu.role.assigned')

      expect(entry).toBeDefined()
      expect(entry?.actorUserId).toBe(actor.id)
      expect(entry?.subjectType).toBe('user')
      expect(entry?.subjectId).toBe(subject.id)
      expect(entry?.payload).toMatchObject({ roleId: role.id })
    })

    it('names the actor and the subject when a role is removed', async () => {
      const role = await createSchoolAndRole()
      const actor = await usersService.create({ email: 'admin2@example.com' })
      const subject = await usersService.create({
        email: 'holder@example.com',
        roles: [role],
      })

      await rolesService.setRolesForUser(subject.id, [], actor.id)

      const rows = await auditRows()
      const entry = rows.find((row) => row.action === 'edu.role.removed')

      expect(entry).toBeDefined()
      expect(entry?.actorUserId).toBe(actor.id)
      expect(entry?.subjectId).toBe(subject.id)
      expect(entry?.payload).toMatchObject({ roleId: role.id })
    })

    it('writes no entry at all when the assignment rolls back', async () => {
      // The property the transactional placement exists for: a failure
      // between deciding what changes and committing it must leave the
      // table exactly as it was, not half-written. Counted from a baseline
      // rather than asserted as zero, because setting up the fixture (the
      // role's own creation) already wrote its own, untransactional entry.
      const role = await createSchoolAndRole()
      const actor = await usersService.create({ email: 'admin3@example.com' })
      const subject = await usersService.create({ email: 'rollback-assign@example.com' })
      const before = (await auditRows()).length

      const saveSpy = jest.spyOn(EntityManager.prototype, 'save').mockImplementationOnce(() => {
        throw new Error('simulated failure')
      })

      try {
        await expect(rolesService.setRolesForUser(subject.id, [role.id], actor.id)).rejects.toThrow(
          'simulated failure',
        )
      } finally {
        saveSpy.mockRestore()
      }

      expect(await auditRows()).toHaveLength(before)
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                                 deleteOneBy                                */
  /* -------------------------------------------------------------------------- */

  describe('deleteOneBy', () => {
    it('writes one entry per holder', async () => {
      const role = await createSchoolAndRole()
      const actor = await usersService.create({ email: 'admin4@example.com' })
      const holderA = await usersService.create({ email: 'holderA2@example.com', roles: [role] })
      const holderB = await usersService.create({ email: 'holderB2@example.com', roles: [role] })

      await rolesService.deleteOneBy({ id: role.id }, actor.id)

      const rows = (await auditRows()).filter((row) => row.action === 'edu.role.deleted')

      expect(rows).toHaveLength(2)
      expect(rows.map((row) => row.subjectId).sort()).toEqual([holderA.id, holderB.id].sort())
      expect(rows.every((row) => row.actorUserId === actor.id)).toBe(true)
      expect(rows.every((row) => row.payload.roleId === role.id)).toBe(true)
    })

    it('writes no entry at all when the delete rolls back', async () => {
      const role = await createSchoolAndRole()
      const actor = await usersService.create({ email: 'admin5@example.com' })
      await usersService.create({ email: 'holder-rollback@example.com', roles: [role] })
      const before = (await auditRows()).length

      // Same failure point `permissionsCacheEviction.spec.ts` uses to prove
      // the cache eviction never runs on a rolled-back delete — the audit
      // write sits after it in the same transaction, so it inherits the
      // same guarantee.
      const removeSpy = jest.spyOn(EntityManager.prototype, 'remove').mockImplementationOnce(() => {
        throw new Error('simulated failure')
      })

      try {
        await expect(rolesService.deleteOneBy({ id: role.id }, actor.id)).rejects.toThrow(
          'simulated failure',
        )
      } finally {
        removeSpy.mockRestore()
      }

      expect(await auditRows()).toHaveLength(before)
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                                 updateOneBy                                */
  /* -------------------------------------------------------------------------- */

  describe('updateOneBy', () => {
    it('records a rewrite of the role’s permissions', async () => {
      const role = await createSchoolAndRole(['schools:read'])
      const actor = await usersService.create({ email: 'admin6@example.com' })

      await rolesService.updateOneBy(
        { id: role.id },
        { permissions: ['schools:read', 'schools:update'] },
        actor.id,
      )

      const rows = await auditRows()
      const entry = rows.find((row) => row.action === 'edu.role.permissionsUpdated')

      expect(entry).toBeDefined()
      expect(entry?.actorUserId).toBe(actor.id)
      expect(entry?.subjectType).toBe('role')
      expect(entry?.subjectId).toBe(role.id)
      expect(entry?.payload).toMatchObject({ permissions: ['schools:read', 'schools:update'] })
    })

    it('records nothing when only the name changes', async () => {
      const role = await createSchoolAndRole(['schools:read'])
      const actor = await usersService.create({ email: 'admin7@example.com' })

      await rolesService.updateOneBy({ id: role.id }, { name: 'Renamed' }, actor.id)

      const rows = await auditRows()
      expect(rows.find((row) => row.action === 'edu.role.permissionsUpdated')).toBeUndefined()
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                                   create                                   */
  /* -------------------------------------------------------------------------- */

  describe('create', () => {
    it('records who created a new role', async () => {
      const school = await schoolsService.create({ name: 'Creation School' })
      const actor = await usersService.create({ email: 'admin8@example.com' })

      const role = await rolesService.create(
        { name: 'New Role', description: 'A new role', schoolId: school.id, permissions: [] },
        actor.id,
      )

      const rows = await auditRows()
      const entry = rows.find((row) => row.action === 'edu.role.created')

      expect(entry).toBeDefined()
      expect(entry?.actorUserId).toBe(actor.id)
      expect(entry?.subjectType).toBe('role')
      expect(entry?.subjectId).toBe(role.id)
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                               createNewSchool                              */
  /* -------------------------------------------------------------------------- */

  describe('createNewSchool', () => {
    it('names the new owner', async () => {
      const owner = await usersService.create({ email: 'owner2@example.com' })

      const school = await schoolCreationService.createNewSchool(owner.id, {
        name: 'New School',
      })

      const rows = await auditRows()
      const entry = rows.find((row) => row.action === 'edu.school.created')

      expect(entry).toBeDefined()
      expect(entry?.actorUserId).toBe(owner.id)
      expect(entry?.subjectType).toBe('school')
      expect(entry?.subjectId).toBe(school.id)
      expect(entry?.payload).toMatchObject({ ownerId: owner.id })
    })

    it('writes no entry at all when school creation rolls back', async () => {
      const owner = await usersService.create({ email: 'owner-rollback@example.com' })

      const saveSpy = jest.spyOn(EntityManager.prototype, 'save').mockImplementationOnce(() => {
        throw new Error('simulated failure')
      })

      try {
        await expect(
          schoolCreationService.createNewSchool(owner.id, { name: 'Never Created' }),
        ).rejects.toThrow('simulated failure')
      } finally {
        saveSpy.mockRestore()
      }

      expect(await auditRows()).toHaveLength(0)
    })
  })
})
