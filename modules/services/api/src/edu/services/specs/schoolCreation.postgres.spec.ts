import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { SchoolCreationService, UsersService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import { testDatabase } from '@vidya/api/shared/datasources'
import { Role, School, User } from '@vidya/entities'
import { DataSource, EntityManager } from 'typeorm'

/**
 * What only a real Postgres can prove about school creation.
 *
 * pg-mem does not undo inserts a rolled-back transaction has already made, so
 * under it this case passes or fails for reasons that have nothing to do with
 * the service. The roles and the school are asked for here instead.
 */
const describeOnPostgres = testDatabase() === 'postgres' ? describe : describe.skip

describeOnPostgres('createNewSchool against Postgres', () => {
  let app: INestApplication
  let schoolCreationService: SchoolCreationService
  let usersService: UsersService
  let dataSource: DataSource

  beforeEach(async () => {
    app = await createTestingApp()

    schoolCreationService = app.get(SchoolCreationService)
    usersService = app.get(UsersService)
    dataSource = app.get(DataSource)
  })

  afterEach(async () => {
    await app.close()
  })

  it('leaves neither role nor school behind when the creation fails', async () => {
    const owner = await usersService.create({ email: faker.internet.email() })

    // The owner is saved after both roles, so a failure there leaves a
    // transaction that has already written every row this asks about.
    const restore = failSaveOf(User)

    try {
      await expect(
        schoolCreationService.createNewSchool(owner.id, { name: 'Never Created' }),
      ).rejects.toThrow('simulated failure')
    } finally {
      restore()
    }

    expect({
      roles: await dataSource.getRepository(Role).count(),
      schools: await dataSource.getRepository(School).count(),
    }).toEqual({ roles: 0, schools: 0 })
  })
})

/** Fails every `save` aimed at one entity class and passes the rest through. */
const failSaveOf = (target: unknown): (() => void) => {
  const original = EntityManager.prototype.save

  const spy = jest.spyOn(EntityManager.prototype, 'save').mockImplementation(function (
    this: EntityManager,
    ...args: unknown[]
  ) {
    if (args[0] === target) {
      throw new Error('simulated failure')
    }
    return (original as any).apply(this, args)
  } as any)

  return () => spy.mockRestore()
}
