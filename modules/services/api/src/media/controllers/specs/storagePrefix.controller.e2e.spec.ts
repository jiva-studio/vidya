import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { Routes } from '@vidya/protocol'
import * as request from 'supertest'

import { createStorageContext, StorageContext, TEST_MASTER_KEY } from './context'

describe('the prefix a technician saves with a storage profile', () => {
  let app: INestApplication
  let ctx: StorageContext

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    app = await createTestingApp()
    ctx = await createStorageContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const put = async (prefix: string) =>
    request(app.getHttpServer())
      .put(Routes().edu.schools.storage.update(ctx.one.school.id))
      .set('Authorization', await ctx.getAuthTokenFor(ctx.one.users.owner))
      .send({ ...ctx.credentialsFor(ctx.one.school.id), prefix })

  it('refuses an empty one, which names every object in the bucket', async () => {
    const response = await put('')

    expect(response.status).toBe(400)
  })

  it('saves no profile for a school whose prefix was refused', async () => {
    await put('')

    expect(await ctx.profileRows(ctx.one.school.id)).toEqual([])
    expect(await ctx.currentProfileIdOf(ctx.one.school.id)).toBeNull()
  })

  it('refuses one made of whitespace, which is the same bucket root spelled twice', async () => {
    const response = await put('   ')

    expect(response.status).toBe(400)
  })
})
