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
import { createMediaFlow, MediaFlow } from './uploadFlow'

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
      usedBytes: 0,
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

/**
 * Rotating a key is the case the whole design of the table exists for: a file
 * is read through the profile that wrote it, never through the one that is
 * current, so the old row has to survive the rotation and stay in the file's.
 */
describe('rotating a key under content that is already published', () => {
  let app: INestApplication
  let flow: MediaFlow

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    app = await createTestingApp()
    flow = await createMediaFlow(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const school = () => flow.ctx.one.school.id
  const owner = () => flow.ctx.one.users.owner

  const rotate = async (bucket: string) =>
    request(app.getHttpServer())
      .put(Routes().edu.schools.storage.update(school()))
      .set('Authorization', await flow.ctx.getAuthTokenFor(owner()))
      .send({ ...flow.ctx.credentialsFor(school()), bucket })
      .expect(200)

  const uploadImage = async (sizeBytes: number) => {
    const asked = await flow.askUpload(
      flow.imageUpload(school(), { sizeBytes, sha256: undefined }),
      owner(),
    )

    expect(asked.status).toBe(201)
    await flow.putBytes(asked.body.grant, Buffer.alloc(sizeBytes, 1))
    expect((await flow.completeUpload(asked.body.mediaId, {}, owner())).status).toBe(200)

    return asked.body.mediaId as string
  }

  const usage = async () => (await flow.usageOf(school(), owner())).body

  it('leaves an uploaded file pointing at the profile that wrote it', async () => {
    await flow.configureStorage(school(), owner())
    const wroteIt = await flow.ctx.currentProfileIdOf(school())
    expect(wroteIt).toEqual(expect.any(String))

    const mediaId = await uploadImage(4096)

    await rotate('vidya-demo-rotated')

    expect(await flow.ctx.currentProfileIdOf(school())).not.toBe(wroteIt)
    await expect(flow.ctx.profileIdOfMedia(mediaId)).resolves.toBe(wroteIt)
  })

  it('keeps the profile a published file reads through, retired but intact', async () => {
    await flow.configureStorage(school(), owner())
    const wroteIt = await flow.ctx.currentProfileIdOf(school())
    await uploadImage(4096)

    await rotate('vidya-demo-rotated')

    const retired = (await flow.ctx.profileRows(school())).find((row) => row.id === wroteIt)

    expect(retired).toBeDefined()
    expect(retired?.retiredAt).not.toBeNull()
    expect(retired?.bucket).toBe(storageProfileFixture.request.bucket)
    expect(retired?.secrets.secret.ciphertext).toBeTruthy()
  })

  // The defect this schema was rewritten for: the count used to live on the
  // profile, so rotating a key on a full bucket reported it as empty.
  it('reports the same occupied bytes before and after the rotation', async () => {
    await flow.configureStorage(school(), owner())
    await uploadImage(4096)
    await uploadImage(1024)

    const before = await usage()
    await rotate('vidya-demo-rotated')
    const after = await usage()

    expect(before.usedBytes).toBe(5120)
    expect(after.usedBytes).toBe(before.usedBytes)
    expect(after.countsByKind).toEqual(before.countsByKind)
  })

  it('counts a file uploaded after the rotation on top, not instead', async () => {
    await flow.configureStorage(school(), owner())
    await uploadImage(4096)

    await rotate('vidya-demo-rotated')
    await uploadImage(1024)

    expect(await usage()).toMatchObject({ usedBytes: 5120 })
  })
})
