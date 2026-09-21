import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { MediaRefusals, Routes } from '@vidya/protocol'
import * as request from 'supertest'

import {
  createStorageContext,
  refusalFor,
  StorageContext,
  storageProfileFixture,
  TEST_MASTER_KEY,
} from './context'

const ROUTE = 'PUT /edu/schools/:schoolId/storage'

/**
 * The probe runs against the in-memory storage fake: it accepts the credentials
 * carried by `storage-profile.json` and refuses any other secret for that key
 * id, so "working keys" and "a wrong secret" are expressible without a bucket
 * on the other end.
 */
describe('handing a school its own storage credentials', () => {
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

  const put = async (body: Record<string, unknown>, user = ctx.one.users.owner) =>
    request(app.getHttpServer())
      .put(Routes().edu.schools.storage.update(ctx.one.school.id))
      .set('Authorization', await ctx.getAuthTokenFor(user))
      .send(body)

  it('refuses an unauthenticated caller', async () => {
    await request(app.getHttpServer())
      .put(Routes().edu.schools.storage.update(ctx.one.school.id))
      .send(ctx.credentialsFor(ctx.one.school.id))
      .expect(401)
  })

  it('refuses a caller who may edit the school but holds no storage permission', async () => {
    const response = await put(ctx.credentialsFor(ctx.one.school.id), ctx.one.users.readonly)

    expect(response.status).toBe(403)
  })

  it('accepts working keys and records the instant the probe proved them', async () => {
    const response = await put(ctx.credentialsFor(ctx.one.school.id))

    expect(response.status).toBe(200)
    expect(response.body.data.verifiedAt).toEqual(expect.any(String))
    expect(Date.parse(response.body.data.verifiedAt)).not.toBeNaN()
    expect(response.body.data.verifyError).toBeNull()
  })

  it('answers with the profile in the shape the fixture declares', async () => {
    const credentials = ctx.credentialsFor(ctx.one.school.id)

    const response = await put(credentials)

    expect(response.body.data).toMatchObject({
      ...storageProfileFixture.response,
      id: response.body.data.id,
      schoolId: ctx.one.school.id,
      prefix: credentials.prefix,
      verifiedAt: response.body.data.verifiedAt,
    })
  })

  // The probe is worth having only if it walks the path the product walks: a
  // narrower check would keep passing after uploads or playback had stopped
  // working.
  it('proves the keys by writing, heading, reading back and deleting, in that order', async () => {
    await put(ctx.credentialsFor(ctx.one.school.id))

    expect(ctx.storageCalls().map((call) => call.op)).toEqual([
      'signUpload',
      'write',
      'head',
      'signRead',
      'readRange',
      'remove',
    ])
  })

  it('writes the probe through a grant, exactly as a browser would', async () => {
    await put(ctx.credentialsFor(ctx.one.school.id))

    const probeKey = `school/${ctx.one.school.id}/.vidya-probe`

    expect(ctx.storageCalls()).toHaveLength(6)
    expect(ctx.storageCalls().map((call) => call.key)).toEqual(Array(6).fill(probeKey))
  })

  it('takes the probe object away again, leaving the bucket as it was', async () => {
    await put(ctx.credentialsFor(ctx.one.school.id))

    expect(ctx.storageCalls().map((call) => call.op)).toContain('remove')
    expect(ctx.objectsLeftUnder(`school/${ctx.one.school.id}`)).toEqual([])
  })

  it('names the provider the school chose, so no endpoint has to be guessed', async () => {
    const credentials = ctx.credentialsFor(ctx.one.school.id)

    const response = await put(credentials)

    expect(response.body.data.provider).toBe(credentials.provider)
    expect(response.body.data.endpoint).toBe(credentials.endpoint)
  })

  it('derives the delivery from the CDN host rather than letting a person choose', async () => {
    const withCdn = await put(ctx.credentialsFor(ctx.one.school.id))

    expect(withCdn.body.data.delivery).toBe(storageProfileFixture.response.delivery)
  })

  it('writes the school prefix for a profile that did not name one', async () => {
    const { prefix: _omitted, ...credentials } = ctx.credentialsFor(ctx.one.school.id)

    const response = await put(credentials)

    expect(response.body.data.prefix).toBe(`school/${ctx.one.school.id}`)
  })

  it('points the school at the profile it just accepted', async () => {
    const response = await put(ctx.credentialsFor(ctx.one.school.id))

    await expect(ctx.currentProfileIdOf(ctx.one.school.id)).resolves.toBe(response.body.data.id)
  })

  it('refuses a wrong secret and leaves the school without a profile', async () => {
    const refusal = refusalFor(ROUTE, MediaRefusals.credentialsRejected)

    const response = await put({
      ...ctx.credentialsFor(ctx.one.school.id),
      secret: 'not-the-secret-this-key-belongs-to',
    })

    expect(response.status).toBe(refusal.status)
    expect(response.body.message).toEqual([MediaRefusals.credentialsRejected])
    await expect(ctx.profileRows(ctx.one.school.id)).resolves.toEqual([])
    await expect(ctx.currentProfileIdOf(ctx.one.school.id)).resolves.toBeNull()
  })

  // The address answered and turned the keys away, which is the school's to
  // fix; being refused the address in the first place is ours.
  it('tells a rejected key apart from an address we would not dial', async () => {
    const response = await put({
      ...ctx.credentialsFor(ctx.one.school.id),
      secret: 'not-the-secret-this-key-belongs-to',
    })

    expect(response.status).toBe(422)
    expect(response.body.message).not.toContain(MediaRefusals.endpointRejected)
    expect(response.body.message).not.toContain(MediaRefusals.storageUnreachable)
  })

  it('never echoes the secret it was handed back in a refusal', async () => {
    const secret = 'not-the-secret-this-key-belongs-to'

    const response = await put({ ...ctx.credentialsFor(ctx.one.school.id), secret })

    expect(response.status).toBe(422)
    expect(response.text).not.toContain(secret)
  })

  it('retires the previous profile instead of editing it', async () => {
    const first = await put(ctx.credentialsFor(ctx.one.school.id))
    const second = await put({
      ...ctx.credentialsFor(ctx.one.school.id),
      bucket: 'vidya-demo-rotated',
    })

    expect(second.body.data.id).not.toBe(first.body.data.id)

    const rows = await ctx.profileRows(ctx.one.school.id)
    const retired = rows.find((row) => row.id === first.body.data.id)
    const current = rows.find((row) => row.id === second.body.data.id)

    expect(rows).toHaveLength(2)
    expect(retired?.retiredAt).not.toBeNull()
    expect(current?.retiredAt).toBeNull()
    await expect(ctx.currentProfileIdOf(ctx.one.school.id)).resolves.toBe(second.body.data.id)
  })

  it('leaves the retired credentials readable, so files it wrote still resolve', async () => {
    const first = await put(ctx.credentialsFor(ctx.one.school.id))
    await put({ ...ctx.credentialsFor(ctx.one.school.id), bucket: 'vidya-demo-rotated' })

    const rows = await ctx.profileRows(ctx.one.school.id)
    const retired = rows.find((row) => row.id === first.body.data.id)

    expect(retired?.accessKeyId).toBe(ctx.credentialsFor(ctx.one.school.id).accessKeyId)
    expect(retired?.secrets.secret.ciphertext).toBeTruthy()
    expect(retired?.bucket).toBe(storageProfileFixture.request.bucket)
  })
})
