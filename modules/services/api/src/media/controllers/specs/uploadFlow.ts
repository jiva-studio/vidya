import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { INestApplication } from '@nestjs/common'
import { ModulesContainer } from '@nestjs/core'
import { InMemoryStorage } from '@vidya/api/media/infra'
import { StoredObject, UploadGrant } from '@vidya/domain'
import { User } from '@vidya/entities'
import { Routes } from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

import { createStorageContext, StorageContext } from './context'

const FIXTURES = join(
  dirname(require.resolve('@vidya/protocol/package.json')),
  '__fixtures__',
  'media',
)

type UploadFixture = { request: Record<string, unknown>; response: Record<string, unknown> }

const fixture = (name: string): UploadFixture =>
  JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), 'utf8')) as UploadFixture

export const grantPutFixture = fixture('upload-grant-put')

/** The digest a browser sends with its ask: base64 SHA-256, as the wire carries it. */
export const digestOf = (body: Buffer): string => createHash('sha256').update(body).digest('base64')
export const mediaPageFixture = fixture('media-page')

/** One row of `media`, as raw SQL hands it back before any mapper sees it. */
export type MediaRow = {
  id: string
  schoolId: string
  kind: string
  status: string
  storageKey: string
  name: string
  mimeType: string
  sizeBytes: string | number
  sha256: string | null
  createdAt: Date
  archivedAt: Date | null
}

export type MediaFlow = {
  ctx: StorageContext
  storage: InMemoryStorage

  configureStorage(schoolId: string, user: User, extra?: Record<string, unknown>): Promise<void>

  askUpload(body: Record<string, unknown>, user: User): Promise<request.Response>
  completeUpload(
    mediaId: string,
    body: Record<string, unknown>,
    user: User,
  ): Promise<request.Response>
  listMedia(query: Record<string, string | number>, user: User): Promise<request.Response>
  usageOf(schoolId: string, user: User): Promise<request.Response>

  /** An upload body of the given size, built from the wire fixture's shape. */
  imageUpload(schoolId: string, overrides?: Record<string, unknown>): Record<string, unknown>

  /** Writes the bytes the way the browser does: by the grant, and nothing else. */
  putBytes(grant: UploadGrant, body: Buffer, contentType?: string): Promise<void>
  objectBehind(grant: UploadGrant): (StoredObject & { body: Buffer }) | undefined
  keyBehind(grant: UploadGrant): string

  mediaRow(mediaId: string): Promise<MediaRow | undefined>
  mediaRowsOf(schoolId: string): Promise<MediaRow[]>

  /** Moves a row's creation instant, so an hourly sweep has something to find. */
  ageRow(mediaId: string, createdAt: Date): Promise<void>

  removalsOf(key: string): number
}

const addressOf = (grant: UploadGrant): { bucket: string; key: string } => {
  const parsed = new URL(grant.url)
  return { bucket: parsed.host, key: parsed.pathname.replace(/^\//, '') }
}

export const createMediaFlow = async (app: INestApplication): Promise<MediaFlow> => {
  const server = app.getHttpServer()
  if (!server.listening) {
    await app.listen(0)
  }
  const ctx = await createStorageContext(app)
  const storage = app.get(InMemoryStorage)
  const ds = app.get(DataSource)

  const flow: MediaFlow = {
    ctx,
    storage,

    async configureStorage(schoolId, user, extra = {}) {
      await request(app.getHttpServer())
        .put(Routes().edu.schools.storage.update(schoolId))
        .set('Authorization', await ctx.getAuthTokenFor(user))
        .send({ ...ctx.credentialsFor(schoolId), ...extra })
        .expect(200)
    },

    async askUpload(body, user) {
      return request(app.getHttpServer())
        .post(Routes().media.uploads())
        .set('Authorization', await ctx.getAuthTokenFor(user))
        .send(body)
    },

    async completeUpload(mediaId, body, user) {
      return request(app.getHttpServer())
        .post(Routes().media.complete(mediaId))
        .set('Authorization', await ctx.getAuthTokenFor(user))
        .send(body)
    },

    async listMedia(query, user) {
      return request(app.getHttpServer())
        .get(Routes().media.find())
        .query(query)
        .set('Authorization', await ctx.getAuthTokenFor(user))
    },

    async usageOf(schoolId, user) {
      return request(app.getHttpServer())
        .get(Routes().edu.schools.storage.usage(schoolId))
        .set('Authorization', await ctx.getAuthTokenFor(user))
    },

    imageUpload(schoolId, overrides = {}) {
      return { ...grantPutFixture.request, schoolId, sizeBytes: 2048, ...overrides }
    },

    async putBytes(grant, body, contentType) {
      const headers = contentType
        ? { ...grant.headers, 'Content-Type': contentType }
        : grant.headers

      await storage.writeByGrant({ ...grant, headers }, body)
    },

    objectBehind(grant) {
      const { bucket, key } = addressOf(grant)
      return storage.objectAt(bucket, key)
    },

    keyBehind(grant) {
      return addressOf(grant).key
    },

    async mediaRow(mediaId) {
      const rows: MediaRow[] = await ds.query('SELECT * FROM "media" WHERE "id" = $1', [mediaId])
      return rows[0]
    },

    async mediaRowsOf(schoolId) {
      return ds.query('SELECT * FROM "media" WHERE "schoolId" = $1 ORDER BY "createdAt" ASC', [
        schoolId,
      ])
    },

    async ageRow(mediaId, createdAt) {
      await ds.query('UPDATE "media" SET "createdAt" = $2 WHERE "id" = $1', [mediaId, createdAt])
    },

    removalsOf(key) {
      return storage.calls.filter((call) => call.op === 'remove' && call.key === key).length
    },
  }

  return flow
}

type CronJobLike = { fireOnTick(): Promise<void> }
type SchedulerLike = { getCronJobs(): Map<string, CronJobLike> }

/**
 * The registry the scheduled work is hung on, found by its shape rather than
 * imported: `@nestjs/schedule` ships as ESM and cannot be required by this
 * suite at all, so the suite reaches the registry through the container.
 */
const schedulerOf = (app: INestApplication): SchedulerLike => {
  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.providers.values()) {
      const instance = wrapper.instance as Partial<SchedulerLike> | undefined
      if (typeof instance?.getCronJobs === 'function') return instance as SchedulerLike
    }
  }

  throw new Error('no scheduler registry is provided, so nothing runs the sweep')
}

/**
 * Fires every scheduled job the application registered, in place of waiting an
 * hour for the tick. A suite cannot name the job it wants without pinning a
 * name nothing else depends on, so it fires them all.
 */
export const runDueJobs = async (app: INestApplication): Promise<void> => {
  for (const [, job] of schedulerOf(app).getCronJobs()) await job.fireOnTick()
}
