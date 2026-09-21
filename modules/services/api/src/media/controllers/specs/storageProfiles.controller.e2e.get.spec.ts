import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { Routes } from '@vidya/protocol'
import * as request from 'supertest'

import {
  createStorageContext,
  StorageContext,
  storageProfileFixture,
  TEST_MASTER_KEY,
} from './context'

const keysOf = (value: Record<string, unknown>): string[] => Object.keys(value).sort()

describe('reading a school storage profile back', () => {
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

  const configure = async (schoolId: string, user = ctx.one.users.owner) =>
    request(app.getHttpServer())
      .put(Routes().edu.schools.storage.update(schoolId))
      .set('Authorization', await ctx.getAuthTokenFor(user))
      .send(ctx.credentialsFor(schoolId))

  const get = async (schoolId: string, user = ctx.one.users.owner) =>
    request(app.getHttpServer())
      .get(Routes().edu.schools.storage.get(schoolId))
      .set('Authorization', await ctx.getAuthTokenFor(user))

  const usage = async (schoolId: string, user = ctx.one.users.owner) =>
    request(app.getHttpServer())
      .get(Routes().edu.schools.storage.usage(schoolId))
      .set('Authorization', await ctx.getAuthTokenFor(user))

  it('refuses an unauthenticated caller', async () => {
    await request(app.getHttpServer())
      .get(Routes().edu.schools.storage.get(ctx.one.school.id))
      .expect(401)
  })

  it('refuses a caller who may read the school but holds no storage permission', async () => {
    const response = await get(ctx.one.school.id, ctx.one.users.readonly)

    expect(response.status).toBe(403)
  })

  it('never puts the secret on the wire, only the key id and its last four', async () => {
    await configure(ctx.one.school.id)

    const response = await get(ctx.one.school.id)
    const body = JSON.parse(response.text).data

    expect(body.accessKeyId).toBe(storageProfileFixture.request.accessKeyId)
    expect(body.secretTail).toHaveLength(4)
    expect(body.secretTail).toBe(storageProfileFixture.request.secret.slice(-4))
    expect(Object.keys(body)).not.toContain('secret')
    expect(response.text).not.toContain(storageProfileFixture.request.secret)
  })

  it('carries no field the fixture does not declare, so nothing new leaks in', async () => {
    await configure(ctx.one.school.id)

    const response = await get(ctx.one.school.id)

    expect(keysOf(JSON.parse(response.text).data)).toEqual(keysOf(storageProfileFixture.response))
  })

  it('keeps the token secret off the wire as well', async () => {
    const configured = await configure(ctx.one.school.id)
    expect(configured.status).toBe(200)

    const response = await get(ctx.one.school.id)

    expect(response.body.data.delivery).toBe('bunny-token')
    expect(response.text).not.toContain(storageProfileFixture.request.tokenSecret)
  })

  it('shows no profile when the school has none and the installation lends none', async () => {
    const response = await get(ctx.one.school.id)

    expect(response.status).toBe(200)
    expect(response.body.data).toBeNull()
  })

  it('reports usage for a school on the default storage of the installation', async () => {
    const response = await usage(ctx.one.school.id)

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      usedBytes: 0,
      reservedBytes: 0,
      countsByKind: { image: 0, video: 0, audio: 0 },
    })
    expect(response.body.quotaBytes).toBeGreaterThan(0)
  })

  it('answers the quota the school itself set once it brought its own bucket', async () => {
    await configure(ctx.one.school.id)

    const response = await usage(ctx.one.school.id)

    expect(response.body.quotaBytes).toBe(storageProfileFixture.request.quotaBytes)
  })

  it('shows a school only its own profile', async () => {
    await configure(ctx.two.school.id, ctx.two.users.technician)

    const response = await get(ctx.one.school.id)

    expect(response.body.data).toBeNull()
  })
})
