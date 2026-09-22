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
import { createMediaFlow, MediaFlow } from './uploadFlow'

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

  it('reports a school that has uploaded nothing as occupying nothing', async () => {
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

describe('what a school on the installation storage is told it occupies', () => {
  const env = process.env
  let app: INestApplication
  let flow: MediaFlow

  beforeEach(async () => {
    process.env = { ...env }
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY

    // The installation lends its bucket to a school with no credentials of its
    // own, and the fake accepts none but the ones the wire fixtures carry — so
    // the lent bucket has to be those.
    process.env.VIDYA_MEDIA_DEFAULT_ENDPOINT = storageProfileFixture.request.endpoint ?? ''
    process.env.VIDYA_MEDIA_DEFAULT_REGION = storageProfileFixture.request.region
    process.env.VIDYA_MEDIA_DEFAULT_BUCKET = storageProfileFixture.request.bucket
    process.env.VIDYA_MEDIA_DEFAULT_ACCESS_KEY_ID = storageProfileFixture.request.accessKeyId
    process.env.VIDYA_MEDIA_DEFAULT_SECRET = storageProfileFixture.request.secret

    app = await createTestingApp()
    flow = await createMediaFlow(app)
  })

  afterEach(async () => {
    await app.close()
    process.env = env
  })

  const school = () => flow.ctx.one.school.id
  const owner = () => flow.ctx.one.users.owner

  const usage = async () => (await flow.usageOf(school(), owner())).body

  // Unhashed on purpose: what is being counted is bytes, and a checksum would
  // bring deduplication into a test that is not about it.
  const askFor = async (sizeBytes: number) => {
    const response = await flow.askUpload(
      flow.imageUpload(school(), { sizeBytes, sha256: undefined }),
      owner(),
    )

    expect(response.status).toBe(201)
    return response.body
  }

  const upload = async (sizeBytes: number) => {
    const granted = await askFor(sizeBytes)
    await flow.putBytes(granted.grant, Buffer.alloc(sizeBytes, 1))

    const completed = await flow.completeUpload(granted.mediaId, {}, owner())
    expect(completed.status).toBe(200)

    return granted
  }

  it('counts a file against the lent bucket once its bytes have landed', async () => {
    await upload(4096)

    expect(await usage()).toMatchObject({
      usedBytes: 4096,
      reservedBytes: 0,
      countsByKind: { image: 1, video: 0, audio: 0 },
    })
  })

  it('writes into the lent bucket under the prefix that is the school', async () => {
    const granted = await upload(4096)

    const key = flow.keyBehind(granted.grant)

    expect(key.split('/').slice(0, 2).join('/')).toBe(`school/${school()}`)
    expect(flow.objectBehind(granted.grant)?.sizeBytes).toBe(4096)
  })

  // What is promised and what is occupied are different facts: counting a grant
  // as occupied would charge a school for an upload that never arrived.
  it('leaves a file whose bytes have not landed out of what is occupied', async () => {
    await askFor(4096)

    expect(await usage()).toMatchObject({ usedBytes: 0, reservedBytes: 4096 })
    expect((await flow.mediaRowsOf(school())).map((row) => row.status)).toEqual(['pending'])
  })

  it('adds a second file to the first rather than replacing it', async () => {
    await upload(4096)
    await upload(1024)

    expect(await usage()).toMatchObject({
      usedBytes: 5120,
      countsByKind: { image: 2, video: 0, audio: 0 },
    })
  })
})
