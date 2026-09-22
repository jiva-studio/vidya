import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import {
  createStorageContext,
  StorageContext,
  TEST_MASTER_KEY,
} from '@vidya/api/media/controllers/specs/context'
import { testingDataSource } from '@vidya/api/shared/datasources'
import { Routes } from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

/**
 * Both applications are given the same datasource, so the second one boots
 * against a database that already holds a profile. Without that the table is
 * empty and there is nothing the missing key would make unreadable.
 */
describe('booting the API against stored storage secrets', () => {
  const env = process.env
  let apps: INestApplication[]
  let ds: DataSource

  beforeEach(async () => {
    process.env = { ...env }
    apps = []
    ds = await testingDataSource()
  })

  afterEach(async () => {
    for (const app of apps) await app.close()
    process.env = env
  })

  const boot = async (): Promise<INestApplication> => {
    const app = await createTestingApp([{ provide: DataSource, useValue: ds }])
    apps.push(app)
    return app
  }

  const configureStorage = async (app: INestApplication, ctx: StorageContext) =>
    request(app.getHttpServer())
      .put(Routes().edu.schools.storage.update(ctx.one.school.id))
      .set('Authorization', await ctx.getAuthTokenFor(ctx.one.users.owner))
      .send(ctx.credentialsFor(ctx.one.school.id))
      .expect(200)

  it('refuses to start, naming the key, when a stored profile cannot be read', async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    const app = await boot()
    await configureStorage(app, await createStorageContext(app))

    delete process.env.VIDYA_MEDIA_MASTER_KEY

    await expect(boot()).rejects.toThrow(/VIDYA_MEDIA_MASTER_KEY/)
  })

  it('starts without the key while no school has handed over credentials', async () => {
    delete process.env.VIDYA_MEDIA_MASTER_KEY

    await expect(boot()).resolves.toBeDefined()
  })

  it('refuses a master key that is not thirty-two bytes of base64', async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = Buffer.alloc(16, 7).toString('base64')

    await expect(boot()).rejects.toThrow(/VIDYA_MEDIA_MASTER_KEY/)
  })
})
