import { Role, School, User } from '@vidya/entities'
import { DataSource } from 'typeorm'

import { bootstrap, emailFromArgv } from '../bootstrap'
import { testingDataSource } from './testing.datasource'

const EMAIL = 'owner@example.com'

describe('bootstrap', () => {
  let dataSource: DataSource

  const schools = () => dataSource.getRepository(School)
  const roles = () => dataSource.getRepository(Role)
  const users = () => dataSource.getRepository(User)

  beforeEach(async () => {
    dataSource = await testingDataSource()
  })

  afterEach(async () => {
    await dataSource.destroy()
  })

  describe('creation', () => {
    it('creates a school, an owner role holding everything, and the user', async () => {
      const result = await bootstrap(dataSource, { email: EMAIL })

      const school = await schools().findOneBy({ id: result.schoolId })
      const role = await roles().findOneBy({ id: result.roleId })
      const user = await users().findOne({
        where: { id: result.userId },
        relations: { roles: true },
      })

      expect(school).not.toBeNull()
      expect(role).toMatchObject({ permissions: ['*'], schoolId: school.id })
      expect(user.email).toBe(EMAIL)
      expect(user.roles.map((held) => held.id)).toEqual([role.id])
      expect(result.created).toBe(true)
    })

    it('takes the school and role names it is given', async () => {
      const result = await bootstrap(dataSource, {
        email: EMAIL,
        schoolName: 'Bhaktivedanta Academy',
        roleName: 'Principal',
      })

      expect((await schools().findOneBy({ id: result.schoolId })).name).toBe(
        'Bhaktivedanta Academy',
      )
      expect((await roles().findOneBy({ id: result.roleId })).name).toBe('Principal')
    })

    it('lower-cases the address, so the same person is one account', async () => {
      const result = await bootstrap(dataSource, { email: '  Owner@Example.COM ' })

      expect((await users().findOneBy({ id: result.userId })).email).toBe(EMAIL)
    })

    it('refuses an empty address rather than creating a user without one', async () => {
      await expect(bootstrap(dataSource, { email: '   ' })).rejects.toThrow(/email/)
      expect(await schools().count()).toBe(0)
    })
  })

  describe('idempotency', () => {
    it('creates nothing the second time', async () => {
      const first = await bootstrap(dataSource, { email: EMAIL })
      const second = await bootstrap(dataSource, { email: EMAIL })

      expect(second.schoolId).toBe(first.schoolId)
      expect(second.roleId).toBe(first.roleId)
      expect(second.userId).toBe(first.userId)
      expect(second.created).toBe(false)

      expect(await schools().count()).toBe(1)
      expect(await roles().count()).toBe(1)
      expect(await users().count()).toBe(1)
    })

    it('gives a second person the owner role in the same school', async () => {
      const first = await bootstrap(dataSource, { email: EMAIL })
      const second = await bootstrap(dataSource, { email: 'second@example.com' })

      expect(second.schoolId).toBe(first.schoolId)
      expect(second.roleId).toBe(first.roleId)
      expect(await users().count()).toBe(2)
      expect(await schools().count()).toBe(1)
    })

    it('adds the role to an account that signed in by code before it was run', async () => {
      await users().save({ email: EMAIL, name: 'Signed in already' })

      const result = await bootstrap(dataSource, { email: EMAIL })

      const user = await users().findOne({
        where: { email: EMAIL },
        relations: { roles: true },
      })

      expect(await users().count()).toBe(1)
      expect(user.roles.map((held) => held.id)).toEqual([result.roleId])
      expect(user.name).toBe('Signed in already')
    })

    it('leaves a role the user already holds elsewhere in place', async () => {
      const other = await schools().save({ name: 'Another School' })
      const otherRole = await roles().save({
        name: 'Teacher',
        description: 'Teaches',
        permissions: ['courses:read'],
        schoolId: other.id,
      })
      await users().save({ email: EMAIL, name: 'Teacher', roles: [otherRole] })

      const result = await bootstrap(dataSource, { email: EMAIL })

      const user = await users().findOne({
        where: { email: EMAIL },
        relations: { roles: true },
      })

      expect(user.roles.map((held) => held.id).sort()).toEqual([otherRole.id, result.roleId].sort())
    })
  })

  describe('a database that is already in use', () => {
    it('destroys nothing, unlike seed, which truncates before it writes', async () => {
      const school = await schools().save({ name: 'Existing School' })
      const role = await roles().save({
        name: 'Student',
        description: 'Studies',
        permissions: ['courses:read'],
        schoolId: school.id,
      })
      const student = await users().save({ email: 'student@example.com', name: 'A student' })

      await bootstrap(dataSource, { email: EMAIL })

      expect(await schools().findOneBy({ id: school.id })).not.toBeNull()
      expect(await roles().findOneBy({ id: role.id })).not.toBeNull()
      expect(await users().findOneBy({ id: student.id })).not.toBeNull()
      expect(await schools().count()).toBe(2)
      expect(await users().count()).toBe(2)
    })
  })
})

describe('emailFromArgv', () => {
  it('reads the address that follows the flag', () => {
    expect(emailFromArgv(['node', 'bootstrap.cli.ts', '--email', EMAIL])).toBe(EMAIL)
  })

  it('reads nothing when the flag is absent', () => {
    expect(emailFromArgv(['node', 'bootstrap.cli.ts'])).toBeUndefined()
  })

  it('reads nothing when the flag is last, so the run stops instead of guessing', () => {
    expect(emailFromArgv(['node', 'bootstrap.cli.ts', '--email'])).toBeUndefined()
  })
})
