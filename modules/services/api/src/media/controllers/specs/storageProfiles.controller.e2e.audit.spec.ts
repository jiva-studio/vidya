import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { AuditAction, AuditLog } from '@vidya/entities'
import { Routes } from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

import { createStorageContext, StorageContext, TEST_MASTER_KEY } from './context'

const WRONG_SECRET = 'not-the-secret-this-key-belongs-to'

// Anything shaped like a credential has no business in the trail, whichever
// field it arrived under.
const SECRET_SHAPED = /dek|ciphertext|nonce|tokenSecret|"secret"/i

describe('the trail a storage profile leaves', () => {
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

  const entriesFor = async (action: AuditAction): Promise<AuditLog[]> => {
    const rows = await app.get(DataSource).getRepository(AuditLog).find()
    return rows.filter((row) => row.action === action)
  }

  const put = async (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .put(Routes().edu.schools.storage.update(ctx.one.school.id))
      .set('Authorization', await ctx.getAuthTokenFor(ctx.one.users.owner))
      .send(body)

  const configure = async () => put(ctx.credentialsFor(ctx.one.school.id))

  const retire = async () =>
    request(app.getHttpServer())
      .delete(Routes().edu.schools.storage.delete(ctx.one.school.id))
      .set('Authorization', await ctx.getAuthTokenFor(ctx.one.users.owner))

  it('records who handed the school its credentials, and for which school', async () => {
    const response = await configure()

    const [entry, ...rest] = await entriesFor('media.storage.configured')

    expect(entry).toBeDefined()
    expect(rest).toHaveLength(0)
    expect(entry?.actorUserId).toBe(ctx.one.users.owner.id)
    expect(entry?.schoolId).toBe(ctx.one.school.id)
    expect(entry?.payload.profileId).toBe(response.body.data.id)
  })

  it('names the credentials it accepted without carrying them', async () => {
    const credentials = ctx.credentialsFor(ctx.one.school.id)

    await configure()

    const [entry] = await entriesFor('media.storage.configured')

    expect(entry).toBeDefined()
    expect(entry?.payload).toMatchObject({
      accessKeyId: credentials.accessKeyId,
      bucket: credentials.bucket,
      endpoint: credentials.endpoint,
      secretTail: credentials.secret.slice(-4),
    })
    expect(JSON.stringify(entry?.payload)).not.toContain(credentials.secret)
    expect(JSON.stringify(entry?.payload)).not.toMatch(SECRET_SHAPED)
  })

  it('records the retirement when a school is returned to the default storage', async () => {
    await configure()

    await retire()

    const [entry, ...rest] = await entriesFor('media.storage.retired')

    expect(entry).toBeDefined()
    expect(rest).toHaveLength(0)
    expect(entry?.actorUserId).toBe(ctx.one.users.owner.id)
    expect(entry?.schoolId).toBe(ctx.one.school.id)
  })

  it('records a probe that turned the keys away, and creates no profile for it', async () => {
    const response = await put({ ...ctx.credentialsFor(ctx.one.school.id), secret: WRONG_SECRET })

    const [entry, ...rest] = await entriesFor('media.storage.verifyFailed')

    expect(response.status).toBe(422)
    expect(entry).toBeDefined()
    expect(rest).toHaveLength(0)
    expect(entry?.schoolId).toBe(ctx.one.school.id)
    await expect(ctx.profileRows(ctx.one.school.id)).resolves.toEqual([])
  })

  it('names how the probe ended, so the trail says why the keys were refused', async () => {
    await put({ ...ctx.credentialsFor(ctx.one.school.id), secret: WRONG_SECRET })

    const [entry] = await entriesFor('media.storage.verifyFailed')

    expect(entry).toBeDefined()
    expect(JSON.stringify(entry?.payload)).toContain('storage-credentials-rejected')
  })

  it('keeps the refused secret out of the trail it writes', async () => {
    await put({ ...ctx.credentialsFor(ctx.one.school.id), secret: WRONG_SECRET })

    const [entry] = await entriesFor('media.storage.verifyFailed')

    expect(entry).toBeDefined()
    expect(JSON.stringify(entry?.payload)).not.toContain(WRONG_SECRET)
    expect(JSON.stringify(entry?.payload)).not.toMatch(SECRET_SHAPED)
  })

  it('writes nothing about storage when the caller was refused the route', async () => {
    await request(app.getHttpServer())
      .put(Routes().edu.schools.storage.update(ctx.one.school.id))
      .set('Authorization', await ctx.getAuthTokenFor(ctx.one.users.readonly))
      .send(ctx.credentialsFor(ctx.one.school.id))
      .expect(403)

    await expect(entriesFor('media.storage.configured')).resolves.toEqual([])
    await expect(entriesFor('media.storage.verifyFailed')).resolves.toEqual([])
  })
})
