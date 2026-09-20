import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'
import { v4 as uuid } from 'uuid'

import { createSyncContext, SECTION_ID, SyncContext } from './context'

/**
 * The wire fixtures, driven through HTTP.
 *
 * One set of fixtures, two sides: the server runs them through the real
 * endpoints and the device through its fake client. Neither side can drift from
 * the contract without this suite, or the device's, going red.
 *
 * The fixtures are read from disk rather than imported: they are data shared
 * with another package, not a module of this one.
 *
 * The package is asked where it lives instead of being counted to in `..`
 * segments. A mutation run copies this service into a sandbox several levels
 * deeper, and a fixed depth resolves to a directory that does not exist there.
 */
const FIXTURES = join(
  dirname(require.resolve('@vidya/protocol/package.json')),
  '__fixtures__',
  'sync',
)

const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), 'utf8')) as T

const keysOf = (value: Record<string, unknown>): string[] => Object.keys(value).sort()

const routes = protocol.Routes().sync
const DEVICE = 'device-8f2a6c14'

describe('sync conformance: the wire fixtures over HTTP', () => {
  let app: INestApplication
  let ds: DataSource
  let ctx: SyncContext

  beforeEach(async () => {
    app = await createTestingApp()
    ds = app.get(DataSource)
    ctx = await createSyncContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const send = (route: string, body: Record<string, unknown>, token = ctx.tokens.student) =>
    request(app.getHttpServer()).post(route).auth(token, { type: 'bearer' }).send(body)

  /* ------------------------------- -------------------------------- */

  describe('the shape of a pull page', () => {
    it('answers with the fields the fixture declares, and no others', async () => {
      const expected = fixture<{ response: protocol.PullResponse }>('pull-page').response

      const body = (
        await send(routes.pull(), { deviceId: DEVICE, cursors: {}, limit: 200 }).expect(200)
      ).body as protocol.PullResponse

      expect(keysOf(body as unknown as Record<string, unknown>)).toEqual(
        keysOf(expected as unknown as Record<string, unknown>),
      )

      expect(body.changes.length).toBeGreaterThan(0)

      for (const change of body.changes) {
        expect(keysOf(change as unknown as Record<string, unknown>)).toEqual(
          keysOf(expected.changes[0] as unknown as Record<string, unknown>),
        )
        expect(keysOf(change.scope as unknown as Record<string, unknown>)).toEqual(['id', 'kind'])
        expect(typeof change.serverSeq).toBe('number')
        expect(typeof change.hlc).toBe('string')
        expect(domain.isIsoDateTime(change.createdAt)).toBe(true)
      }
    })

    it('describes a scope grant the way the fixture does', async () => {
      const expected = fixture<{ response: protocol.PullResponse }>('pull-new-scope').response

      const body = (await send(routes.pull(), { deviceId: DEVICE, cursors: {} }).expect(200))
        .body as protocol.PullResponse

      for (const grant of body.scopes) {
        expect(keysOf(grant as unknown as Record<string, unknown>)).toEqual(
          keysOf(expected.scopes[0] as unknown as Record<string, unknown>),
        )
        expect(typeof grant.headSeq).toBe('number')
      }
    })

    it('refuses too many scopes with the shape the fixture declares', async () => {
      const errors = fixture<{ cases: { code: string; statusCode: number; error: string }[] }>(
        'request-errors',
      )
      const expected = errors.cases.find((c) => c.code === 'tooManyScopes')

      const cursors: Record<string, number> = {}

      for (let index = 0; index <= protocol.SYNC_MAX_SCOPES; index += 1) {
        cursors[`course:${index}`] = 0
      }

      const response = await send(routes.pull(), { deviceId: DEVICE, cursors }).expect(400)

      expect(response.body.code).toBe(expected.code)
      expect(response.body.statusCode).toBe(expected.statusCode)
      expect(response.body.error).toBe(expected.error)
      expect(Array.isArray(response.body.message)).toBe(true)
    })
  })

  /* --------------------------- and --------------------------- */

  describe('the shape of a push answer', () => {
    const pushBody = (changes: Record<string, unknown>[]) => ({ deviceId: DEVICE, changes })

    const mixed = fixture<{ response: protocol.PushResponse }>('push-mixed').response

    it('answers one row per change, in order, with the declared fields', async () => {
      const good = {
        outboxId: 41,
        collection: 'homework',
        docId: uuid(),
        op: 'upsert',
        hlc: '001789686000000:00000:device-8f2a6c14',
        baseHlc: null,
        data: {
          enrollmentId: ctx.enrollment.id,
          lessonVersionId: ctx.mine.published.id,
          sectionId: SECTION_ID,
          text: 'A longer answer, written on the train.',
          submittedAt: '2026-09-17T23:00:00.000Z',
        },
      }

      const refused = { ...good, outboxId: 43, collection: 'courses', docId: ctx.mine.course.id }

      const body = (await send(routes.push(), pushBody([good, refused])).expect(200))
        .body as protocol.PushResponse

      expect(keysOf(body as unknown as Record<string, unknown>)).toEqual(
        keysOf(mixed as unknown as Record<string, unknown>),
      )
      expect(body.results.map((result) => result.outboxId)).toEqual([41, 43])

      const accepted = mixed.results.find((result) => result.status === 'accepted')
      const rejected = mixed.results.find((result) => result.status === 'rejected')

      expect(keysOf(body.results[0] as unknown as Record<string, unknown>)).toEqual(
        keysOf(accepted as unknown as Record<string, unknown>),
      )
      expect(keysOf(body.results[1] as unknown as Record<string, unknown>)).toEqual(
        keysOf(rejected as unknown as Record<string, unknown>),
      )
    })

    it('names the row it wrote, with the fields push-natural-key declares', async () => {
      const expected = fixture<{ response: protocol.PushResponse }>('push-natural-key').response
      const renamed = expected.results[0] as protocol.PushAccepted

      const body = (sectionId: string, docId: string) => ({
        outboxId: 81,
        collection: 'homework',
        docId,
        op: 'upsert',
        hlc: `001789729700000:00000:${sectionId}`,
        baseHlc: null,
        data: {
          enrollmentId: ctx.enrollment.id,
          lessonVersionId: ctx.mine.published.id,
          sectionId: SECTION_ID,
          text: 'Handed in twice, from two devices of one student.',
        },
      })

      const first = uuid()

      await send(routes.push(), pushBody([body('device-8f2a6c14', first)])).expect(200)

      const second = (
        await send(routes.push(), {
          deviceId: 'device-b21e7f05',
          changes: [body('device-b21e7f05', uuid())],
        }).expect(200)
      ).body as protocol.PushResponse

      expect(keysOf(second.results[0] as unknown as Record<string, unknown>)).toEqual(
        keysOf(renamed as unknown as Record<string, unknown>),
      )
      expect((second.results[0] as protocol.PushAccepted).serverDocId).toBe(first)
    })

    it('every rejection reason the fixtures name is one the domain knows', () => {
      const rejections = fixture<{ response: { results: { reason?: string }[] } }>(
        'push-rejections',
      ).response

      const named = rejections.results.map((result) => result.reason)

      expect(named.every((reason) => domain.isSyncRejectionReason(reason))).toBe(true)
      expect(new Set(named)).toEqual(new Set(domain.SyncRejectionReasons))
    })
  })

  /* ------------------------------- -------------------------------- */

  describe('optional and nullable fields at their edges', () => {
    it('reads a pull request with no limit', async () => {
      const asked = fixture<{ request: { cursors: protocol.SyncCursors } }>(
        'optional-fields',
      ).request

      const body = (
        await send(routes.pull(), { deviceId: DEVICE, cursors: asked.cursors }).expect(200)
      ).body as protocol.PullResponse

      expect(body.hasMore).toBe(false)
      expect(body.changes.length).toBeGreaterThan(0)
    })

    it('hands a tombstone down with a null body', async () => {
      await ds.query(
        `INSERT INTO sync_journal
           (collection, doc_id, op, data, hlc, scope_kind, scope_id, school_id, device_id, author_id)
         VALUES ('lesson_versions', $1, 'delete', NULL, $2, 'course', $3, $4, NULL, NULL)`,
        [uuid(), '001789689609000:00000:server', ctx.mine.course.id, ctx.schoolId],
      )

      const body = (await send(routes.pull(), { deviceId: DEVICE, cursors: {} }).expect(200))
        .body as protocol.PullResponse

      const tombstone = body.changes.find((change) => change.op === 'delete')

      expect(tombstone).toBeDefined()
      expect(tombstone.data).toBeNull()
    })

    it('accepts an empty answer and answers it without a detail', async () => {
      const change = {
        outboxId: 70,
        collection: 'homework',
        docId: uuid(),
        op: 'upsert',
        hlc: '001789689540000:00000:device-8f2a6c14',
        baseHlc: null,
        data: {
          enrollmentId: ctx.enrollment.id,
          lessonVersionId: ctx.mine.published.id,
          sectionId: SECTION_ID,
          text: '',
          submittedAt: null,
        },
      }

      const body = (await send(routes.push(), { deviceId: DEVICE, changes: [change] }).expect(200))
        .body as protocol.PushResponse

      expect(body.results[0]).toEqual({
        outboxId: 70,
        collection: 'homework',
        docId: change.docId,
        status: 'accepted',
        serverHlc: change.hlc,
        restamped: false,
      })
      expect(body.journaledOutboxId).toBe(70)
    })

    it('answers an empty page with no scopes advanced', async () => {
      const body = (
        await send(routes.pull(), {
          deviceId: DEVICE,
          cursors: {
            [`user:${ctx.student.id}`]: 999_999,
            [`school:${ctx.schoolId}`]: 999_999,
            [`course:${ctx.mine.course.id}`]: 999_999,
          },
        }).expect(200)
      ).body as protocol.PullResponse

      expect(body.changes).toEqual([])
      expect(body.cursors).toEqual({})
      expect(body.hasMore).toBe(false)
    })
  })

  /* ------------------------------- -------------------------------- */

  describe('the HLC on the wire is the domain HLC', () => {
    const hlcs = fixture<{
      samples: { hlc: string; physical: number; counter: number; deviceId: string }[]
      ascending: string[]
    }>('hlc-format')

    it('parses every sample to the components the fixture declares', () => {
      for (const sample of hlcs.samples) {
        const parsed = domain.parseHlc(sample.hlc)

        expect(parsed.physical).toBe(sample.physical)
        expect(parsed.counter).toBe(sample.counter)
        expect(parsed.deviceId).toBe(sample.deviceId)
        expect(domain.hlcToString(parsed)).toBe(sample.hlc)
      }
    })

    it('orders them the same way text does, which is how the column is read', () => {
      const byDomain = [...hlcs.ascending].sort(domain.compareHlcString)
      const byText = [...hlcs.ascending].sort()

      expect(byDomain).toEqual(hlcs.ascending)
      expect(byText).toEqual(hlcs.ascending)
    })

    it('gives a pushed stamp back unchanged, and journals it as sent', async () => {
      const sent = '001789689540000:00007:a:b:c'
      const change = {
        outboxId: 1,
        collection: 'homework',
        docId: uuid(),
        op: 'upsert',
        hlc: sent,
        baseHlc: null,
        data: {
          enrollmentId: ctx.enrollment.id,
          lessonVersionId: ctx.mine.published.id,
          sectionId: SECTION_ID,
          text: 'Stamped by a device whose id has colons in it',
        },
      }

      const body = (await send(routes.push(), { deviceId: 'a:b:c', changes: [change] }).expect(200))
        .body as protocol.PushResponse

      expect((body.results[0] as protocol.PushAccepted).serverHlc).toBe(sent)

      const rows = await ds.query('SELECT hlc FROM sync_journal WHERE doc_id = $1', [change.docId])
      expect(rows[0].hlc).toBe(sent)
    })
  })

  /* ------------------------------- -------------------------------- */

  describe('the cursor, and the endpoint that does not exist', () => {
    it('answers an acknowledgement with 204 and no body', async () => {
      const ack = fixture<{ request: protocol.AckCursorRequest; status: number }>('cursor-ack')

      const response = await send(routes.cursor(), ack.request).expect(ack.status)

      expect(response.text).toBe('')
    })

    it('has no backfill endpoint: a new scope is pulled like any other', async () => {
      const ack = fixture<{ absentEndpoints: string[] }>('cursor-ack')

      for (const absent of ack.absentEndpoints) {
        await send(absent, {}).expect(404)
      }
    })
  })
})
