import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { SyncCursorsService } from '@vidya/api/sync'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

import { createSyncContext, seedJournal, SyncContext } from './context'

const routes = protocol.Routes().sync
const DEVICE = 'device-8f2a6c14'

/**
 * The checksum as a device computes it: folded over the newest stamp of every
 * document it holds for the scope.
 *
 * Written out here rather than imported, because the point of the test is that
 * a second implementation, working from what the device stored rather than from
 * the journal, arrives at the same number (I-5).
 */
const deviceChecksum = (documents: Map<string, string>): string => {
  let hash = 0n

  for (const [key, hlc] of documents) {
    let doc = 0xcbf29ce484222325n
    const value = `${key}:${hlc}`

    for (let index = 0; index < value.length; index += 1) {
      doc = ((doc ^ BigInt(value.charCodeAt(index))) * 0x100000001b3n) & 0xffffffffffffffffn
    }

    hash ^= doc
  }

  return hash.toString(16).padStart(16, '0')
}

describe('sync scopes, checksums and the acknowledged position', () => {
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

  const pull = (body: Partial<protocol.PullRequest> = {}) =>
    request(app.getHttpServer())
      .post(routes.pull())
      .auth(ctx.tokens.student, { type: 'bearer' })
      .send({ deviceId: DEVICE, cursors: {}, ...body })

  const cursor = (body: Partial<protocol.AckCursorRequest>) =>
    request(app.getHttpServer())
      .post(routes.cursor())
      .auth(ctx.tokens.student, { type: 'bearer' })
      .send({ deviceId: DEVICE, ackedSeq: 0, ...body })

  const own = (): domain.SyncScopeRef => ({ kind: 'user', id: ctx.student.id })
  const mine = (): domain.SyncScopeRef => ({ kind: 'course', id: ctx.mine.course.id })

  /* ------------------------------- T-S-34 ------------------------------- */

  describe('T-S-34: the acknowledged position is kept', () => {
    it('stores what the device says it has applied, and answers 204', async () => {
      await cursor({ ackedSeq: 1302 }).expect(204).expect('')

      expect(await app.get(SyncCursorsService).acknowledged(ctx.student.id, DEVICE)).toBe(1302)
    })

    it('never moves backwards, so a late repeat cannot lower it', async () => {
      await cursor({ ackedSeq: 1302 }).expect(204)
      await cursor({ ackedSeq: 40 }).expect(204)

      expect(await app.get(SyncCursorsService).acknowledged(ctx.student.id, DEVICE)).toBe(1302)
    })

    it('keeps one position per identity on a shared device', async () => {
      await cursor({ ackedSeq: 500 }).expect(204)

      await request(app.getHttpServer())
        .post(routes.cursor())
        .auth(ctx.tokens.stranger, { type: 'bearer' })
        .send({ deviceId: DEVICE, ackedSeq: 7 })
        .expect(204)

      const cursors = app.get(SyncCursorsService)

      expect(await cursors.acknowledged(ctx.student.id, DEVICE)).toBe(500)
      expect(await cursors.acknowledged(ctx.stranger.id, DEVICE)).toBe(7)
    })

    it('refuses a caller with no token', () =>
      request(app.getHttpServer())
        .post(routes.cursor())
        .send({ deviceId: DEVICE, ackedSeq: 1 })
        .expect(401))
  })

  /* ------------------------------ T-S-34b ------------------------------- */

  describe('T-S-34b: a checksum per scope, moving only with its own contents', () => {
    it('gives every granted scope a checksum', async () => {
      const body = (await pull().expect(200)).body as protocol.PullResponse

      expect(Object.keys(body.checksums).sort()).toEqual(
        [domain.syncScopeKey(own()), domain.syncScopeKey(mine())].sort(),
      )
    })

    it('does not move when nothing changed', async () => {
      const first = (await pull().expect(200)).body as protocol.PullResponse
      const second = (await pull().expect(200)).body as protocol.PullResponse

      expect(second.checksums).toEqual(first.checksums)
    })

    it('moves the changed scope and leaves the other alone', async () => {
      const before = (await pull().expect(200)).body as protocol.PullResponse

      await seedJournal(ds, own(), { schoolId: ctx.schoolId, count: 1 })

      const after = (await pull().expect(200)).body as protocol.PullResponse

      expect(after.checksums[domain.syncScopeKey(own())]).not.toBe(
        before.checksums[domain.syncScopeKey(own())],
      )
      expect(after.checksums[domain.syncScopeKey(mine())]).toBe(
        before.checksums[domain.syncScopeKey(mine())],
      )
    })
  })

  /* ------------------------------- T-S-40 ------------------------------- */

  describe('T-S-40: the two sides agree, and disagree when they should', () => {
    const applied = (changes: readonly protocol.SyncChange[], scope: domain.SyncScopeRef) => {
      const documents = new Map<string, string>()

      for (const change of changes) {
        if (domain.syncScopeKey(change.scope) !== domain.syncScopeKey(scope)) continue

        documents.set(`${change.collection}:${change.docId}`, change.hlc)
      }

      return documents
    }

    it('agrees after a full cycle', async () => {
      await seedJournal(ds, mine(), { schoolId: ctx.schoolId, count: 4 })

      const body = (await pull({ limit: protocol.SYNC_MAX_PULL_LIMIT }).expect(200))
        .body as protocol.PullResponse

      expect(body.hasMore).toBe(false)
      expect(deviceChecksum(applied(body.changes, mine()))).toBe(
        body.checksums[domain.syncScopeKey(mine())],
      )
    })

    it('finds a scope that has drifted', async () => {
      const body = (await pull({ limit: protocol.SYNC_MAX_PULL_LIMIT }).expect(200))
        .body as protocol.PullResponse

      const documents = applied(body.changes, mine())
      const [first] = [...documents.keys()]

      // A device that missed one row, which is precisely what this is for.
      documents.delete(first)

      expect(deviceChecksum(documents)).not.toBe(body.checksums[domain.syncScopeKey(mine())])
    })
  })
})
