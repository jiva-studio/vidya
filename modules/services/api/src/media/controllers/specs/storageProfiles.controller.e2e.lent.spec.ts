import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { AuditLog } from '@vidya/entities'
import { Routes } from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

import { createStorageContext, StorageContext, TEST_MASTER_KEY } from './context'

/**
 * The installation's own bucket, given values no school's profile uses, so a
 * value appearing in an answer can only have come from here.
 */
const INSTALLATION = {
  endpoint: 'https://installation-s3.storage.bunnycdn.com',
  region: 'de',
  bucket: 'vidya-installation-bucket',
  accessKeyId: 'installation-key-id',
  secret: 'installation-secret-no-school-holds',
}

const INSTALLATION_ENV = {
  VIDYA_MEDIA_DEFAULT_ENDPOINT: INSTALLATION.endpoint,
  VIDYA_MEDIA_DEFAULT_REGION: INSTALLATION.region,
  VIDYA_MEDIA_DEFAULT_BUCKET: INSTALLATION.bucket,
  VIDYA_MEDIA_DEFAULT_ACCESS_KEY_ID: INSTALLATION.accessKeyId,
  VIDYA_MEDIA_DEFAULT_SECRET: INSTALLATION.secret,
}

/** Everything about the installation's bucket a school must never be told. */
const LENT_DETAILS = [
  INSTALLATION.endpoint,
  'installation-s3.storage.bunnycdn.com',
  INSTALLATION.bucket,
  INSTALLATION.accessKeyId,
  INSTALLATION.secret,
]

describe('a school storing in the installation bucket', () => {
  let app: INestApplication
  let ctx: StorageContext

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    Object.assign(process.env, INSTALLATION_ENV)

    app = await createTestingApp()
    ctx = await createStorageContext(app)
  })

  afterEach(async () => {
    for (const name of Object.keys(INSTALLATION_ENV)) delete process.env[name]
    await app.close()
  })

  const read = async (schoolId: string, user = ctx.one.users.owner) =>
    request(app.getHttpServer())
      .get(Routes().edu.schools.storage.get(schoolId))
      .set('Authorization', await ctx.getAuthTokenFor(user))

  const verify = async (schoolId: string) =>
    request(app.getHttpServer())
      .post(Routes().edu.schools.storage.verify(schoolId))
      .set('Authorization', await ctx.getAuthTokenFor(ctx.one.users.owner))

  const configure = async () =>
    request(app.getHttpServer())
      .put(Routes().edu.schools.storage.update(ctx.one.school.id))
      .set('Authorization', await ctx.getAuthTokenFor(ctx.one.users.owner))
      .send(ctx.credentialsFor(ctx.one.school.id))

  it('is told it is storing in a bucket that is not its own', async () => {
    const response = await read(ctx.one.school.id)

    expect(response.status).toBe(200)
    expect(response.body.data).not.toBeNull()
    expect(response.body.data.lent).toBe(true)
  })

  it('is told the prefix its own files live under', async () => {
    const response = await read(ctx.one.school.id)

    expect(response.body.data).not.toBeNull()
    expect(response.body.data.prefix).toBe(`school/${ctx.one.school.id}`)
  })

  it('is told nothing that would let it reach the bucket itself', async () => {
    const response = await read(ctx.one.school.id)

    expect(response.body.data).not.toBeNull()
    for (const detail of LENT_DETAILS) expect(response.text).not.toContain(detail)
  })

  it('is told nothing about the bucket by a probe that failed against it', async () => {
    const response = await verify(ctx.one.school.id)

    for (const detail of LENT_DETAILS) expect(response.text).not.toContain(detail)
  })

  it('leaves nothing about the bucket in the trail', async () => {
    await verify(ctx.one.school.id)
    await read(ctx.one.school.id)

    const rows = await app.get(DataSource).getRepository(AuditLog).find()

    for (const detail of LENT_DETAILS) expect(JSON.stringify(rows)).not.toContain(detail)
  })

  it('stops being lent the bucket once it has handed over keys of its own', async () => {
    const credentials = ctx.credentialsFor(ctx.one.school.id)

    await configure()
    const response = await read(ctx.one.school.id)

    expect(response.body.data.lent).toBe(false)
    expect(response.body.data.bucket).toBe(credentials.bucket)
    expect(response.body.data.accessKeyId).toBe(credentials.accessKeyId)
    expect(response.body.data.endpoint).toBe(credentials.endpoint)
  })

  it('lends the bucket to every school that has not brought one, not only the first', async () => {
    const response = await read(ctx.two.school.id, ctx.two.users.technician)

    expect(response.body.data).not.toBeNull()
    expect(response.body.data.lent).toBe(true)
    expect(response.body.data.prefix).toBe(`school/${ctx.two.school.id}`)
  })
})
