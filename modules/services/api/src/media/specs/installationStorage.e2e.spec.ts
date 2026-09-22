import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { TEST_MASTER_KEY } from '@vidya/api/media/controllers/specs/context'
import { createMediaFlow, MediaFlow } from '@vidya/api/media/controllers/specs/uploadFlow'
import { acceptedCredentials } from '@vidya/api/media/infra'
import { UploadGrant } from '@vidya/domain'
import { MediaRefusals, Routes } from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

const BUCKET = 'vidya-installation'
const CDN = 'https://cdn.installation.example'
const ENDPOINT = 'https://de-s3.storage.bunnycdn.com'
const QUOTA = 40_000

type ProfileRow = { id: string; bucket: string; prefix: string; provider: string }

/**
 * The environment a deployment with storage of its own runs with. The
 * credentials are the ones the in-memory fake accepts, so the bytes of an
 * upload can be followed all the way into the bucket.
 */
const useInstallationStorage = (quotaBytes: number): void => {
  const accepted = acceptedCredentials()

  process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
  process.env.VIDYA_MEDIA_DEFAULT_ENDPOINT = ENDPOINT
  process.env.VIDYA_MEDIA_DEFAULT_REGION = 'de'
  process.env.VIDYA_MEDIA_DEFAULT_BUCKET = BUCKET
  process.env.VIDYA_MEDIA_DEFAULT_ACCESS_KEY_ID = accepted.accessKeyId
  process.env.VIDYA_MEDIA_DEFAULT_SECRET = accepted.secret
  process.env.VIDYA_MEDIA_DEFAULT_PUBLIC_BASE_URL = CDN
  process.env.VIDYA_MEDIA_DEFAULT_QUOTA_BYTES = String(quotaBytes)
}

const forgetInstallationStorage = (): void => {
  for (const name of [
    'VIDYA_MEDIA_DEFAULT_ENDPOINT',
    'VIDYA_MEDIA_DEFAULT_REGION',
    'VIDYA_MEDIA_DEFAULT_BUCKET',
    'VIDYA_MEDIA_DEFAULT_ACCESS_KEY_ID',
    'VIDYA_MEDIA_DEFAULT_SECRET',
    'VIDYA_MEDIA_DEFAULT_PUBLIC_BASE_URL',
    'VIDYA_MEDIA_DEFAULT_QUOTA_BYTES',
  ]) {
    delete process.env[name]
  }
}

describe('uploading for a school that brought no bucket of its own', () => {
  let app: INestApplication
  let flow: MediaFlow

  const bootWith = async (quotaBytes: number): Promise<void> => {
    useInstallationStorage(quotaBytes)
    app = await createTestingApp()
    flow = await createMediaFlow(app)
  }

  afterEach(async () => {
    await app.close()
    forgetInstallationStorage()
  })

  const schoolId = (): string => flow.ctx.one.school.id

  const ask = async (sizeBytes: number) =>
    flow.askUpload(
      flow.imageUpload(schoolId(), { sizeBytes, sha256: undefined }),
      flow.ctx.one.users.owner,
    )

  const readProfile = async () =>
    request(app.getHttpServer())
      .get(Routes().edu.schools.storage.get(schoolId()))
      .set('Authorization', await flow.ctx.getAuthTokenFor(flow.ctx.one.users.owner))

  const askProbe = async () =>
    request(app.getHttpServer())
      .post(Routes().edu.schools.storage.verify(schoolId()))
      .set('Authorization', await flow.ctx.getAuthTokenFor(flow.ctx.one.users.owner))

  const profileOf = async (profileId: string): Promise<ProfileRow> => {
    const rows: ProfileRow[] = await app
      .get(DataSource)
      .query('SELECT * FROM "storage_profiles" WHERE "id" = $1', [profileId])

    return rows[0]
  }

  describe('with room in the bucket of the installation', () => {
    beforeEach(async () => {
      await bootWith(QUOTA)
    })

    it('signs an upload into the installation bucket under a prefix of the school', async () => {
      const response = await ask(2048)

      expect(response.status).toBe(201)
      const grant = response.body.grant as UploadGrant
      const url = new URL(grant.url)

      expect(url.host).toBe(BUCKET)
      expect(flow.keyBehind(grant)).toMatch(new RegExp(`^school/${schoolId()}/`))
    })

    it('lands the bytes in that bucket and turns the row ready', async () => {
      const granted = await ask(2048)
      const grant = granted.body.grant as UploadGrant

      await flow.putBytes(grant, Buffer.alloc(2048, 5))
      const completed = await flow.completeUpload(
        granted.body.mediaId,
        {},
        flow.ctx.one.users.owner,
      )

      expect(completed.status).toBe(200)
      expect(flow.objectBehind(grant)?.sizeBytes).toBe(2048)
      expect((await flow.mediaRow(granted.body.mediaId))?.status).toBe('ready')
    })

    it('writes the school a profile of its own, naming the storage of the installation', async () => {
      const granted = await ask(2048)
      const row = await flow.mediaRow(granted.body.mediaId)
      const profile = await profileOf((row as unknown as { profileId: string }).profileId)

      expect(profile.bucket).toBe(BUCKET)
      expect(profile.prefix).toBe(`school/${schoolId()}`)
    })

    // The row carries no ceiling of its own, and nobody decided one for this
    // school: what limits it is the default the installation runs with.
    it('limits it to the quota of the installation, which is not on the row', async () => {
      await ask(2048)

      const decided = await app
        .get(DataSource)
        .query('SELECT "quotaBytes" FROM "school_storage_quotas" WHERE "schoolId" = $1', [
          schoolId(),
        ])
      const usage = await flow.usageOf(schoolId(), flow.ctx.one.users.owner)

      expect(decided).toHaveLength(0)
      expect(usage.body.quotaBytes).toBe(QUOTA)
    })

    it('charges what it stored against the quota of the installation', async () => {
      const granted = await ask(2048)
      await flow.putBytes(granted.body.grant as UploadGrant, Buffer.alloc(2048, 5))
      await flow.completeUpload(granted.body.mediaId, {}, flow.ctx.one.users.owner)

      const usage = await flow.usageOf(schoolId(), flow.ctx.one.users.owner)

      expect(usage.status).toBe(200)
      expect(usage.body).toMatchObject({ quotaBytes: QUOTA, usedBytes: 2048 })
    })
  })

  describe('reading back what it was lent', () => {
    beforeEach(async () => {
      await bootWith(QUOTA)
      expect((await ask(2048)).status).toBe(201)
    })

    it('says the storage is lent and names neither the bucket nor the key', async () => {
      const response = await readProfile()

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        lent: true,
        endpoint: '',
        bucket: '',
        accessKeyId: '',
        secretTail: '',
      })
    })

    it('puts nothing of the installation credentials anywhere in the answer', async () => {
      const response = await readProfile()

      expect(response.text).not.toContain(BUCKET)
      expect(response.text).not.toContain(ENDPOINT)
      expect(response.text).not.toContain(acceptedCredentials().accessKeyId)
      expect(response.text).not.toContain(acceptedCredentials().secret)
    })

    it('still answers what the school can act on', async () => {
      const response = await readProfile()

      expect(response.body.data).toMatchObject({
        publicBaseUrl: CDN,
        prefix: `school/${schoolId()}`,
        quotaBytes: QUOTA,
      })
    })

    it('refuses to probe credentials that are not the school to prove', async () => {
      const response = await askProbe()

      expect(response.status).toBe(409)
      expect(response.body.message).toContain(MediaRefusals.notConfigured)
    })
  })

  describe('once it brings credentials of its own', () => {
    beforeEach(async () => {
      await bootWith(QUOTA)
      expect((await ask(2048)).status).toBe(201)
      await flow.configureStorage(schoolId(), flow.ctx.one.users.owner)
    })

    it('reads its own bucket and key back, with nothing masked', async () => {
      const own = flow.ctx.credentialsFor(schoolId())
      const response = await readProfile()

      expect(response.body.data).toMatchObject({
        lent: false,
        endpoint: own.endpoint,
        bucket: own.bucket,
        accessKeyId: own.accessKeyId,
        secretTail: own.secret.slice(-4),
      })
    })

    it('is allowed to have those credentials probed again', async () => {
      const response = await askProbe()

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({ lent: false, verifyError: null })
    })
  })

  describe('with the bucket of the installation already full', () => {
    beforeEach(async () => {
      await bootWith(1024)
    })

    it('refuses the upload rather than overfilling what the installation pays for', async () => {
      const response = await ask(4096)

      expect(response.status).toBe(413)
      expect(response.body.message).toContain(MediaRefusals.quotaExceeded)
    })
  })

  describe('on an installation with no storage of its own', () => {
    beforeEach(async () => {
      forgetInstallationStorage()
      process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY

      app = await createTestingApp()
      flow = await createMediaFlow(app)
    })

    it('says storage is not configured instead of inventing a bucket', async () => {
      const response = await ask(2048)

      expect(response.status).toBe(409)
      expect(response.body.message).toContain(MediaRefusals.notConfigured)
      expect(await flow.ctx.profileRows(schoolId())).toHaveLength(0)
    })
  })
})
