import type { SyncRejectionReason } from '@vidya/domain'
import { syncScopeKey } from '@vidya/domain'
import type {
  AckCursorRequest,
  PullRequest,
  PullResponse,
  PushRequest,
  PushResponse,
  PushResult,
} from '@vidya/protocol'
import optionalFields from '@vidya/protocol/__fixtures__/sync/optional-fields.json'
import pullNewScope from '@vidya/protocol/__fixtures__/sync/pull-new-scope.json'
import pullPage from '@vidya/protocol/__fixtures__/sync/pull-page.json'
import pushMixed from '@vidya/protocol/__fixtures__/sync/push-mixed.json'
import pushNaturalKey from '@vidya/protocol/__fixtures__/sync/push-natural-key.json'
import pushRejections from '@vidya/protocol/__fixtures__/sync/push-rejections.json'
import pushRestamped from '@vidya/protocol/__fixtures__/sync/push-restamped.json'
import type { ISyncClient } from '@vidya/usecases'
import { describe, expect, it } from 'vitest'

import { openTestDatabase } from '@/infra/persistence/testing'
import type { IDatabase } from '@/ports'

import { createSyncEngine, type SyncEngine } from '../engine'
import { COURSE_SCOPE, FakeSyncServer } from './fakeSyncServer'
import { DEVICE, OWNER } from './harness'

/**
 * The shared fuse: the wire fixtures of `libs/protocol/__fixtures__/sync/`,
 * driven through the device.
 *
 * The server runs these same files through HTTP. Agreement has to be enforced
 * by something both sides consume, and a fixture both sides read is the only
 * thing that catches a contract drifting apart before the two are first put
 * together.
 *
 * The device's half of the conformance set is deliberately about *reading*: can
 * the engine take each answer exactly as the contract prints it, without
 * knowing which server produced it.
 */

/** A client that hands back a prepared answer and records what it was asked. */
class FixtureClient implements ISyncClient {
  readonly pullRequests: PullRequest[] = []
  readonly pushRequests: PushRequest[] = []
  readonly ackRequests: AckCursorRequest[] = []

  constructor(
    private readonly page: PullResponse,
    private readonly answer: (request: PushRequest) => PushResponse = () => ({
      results: [],
      journaledOutboxId: 0,
    }),
  ) {}

  async pull(request: PullRequest): Promise<PullResponse> {
    this.pullRequests.push(request)
    return this.page
  }

  async push(request: PushRequest): Promise<PushResponse> {
    this.pushRequests.push(request)
    return this.answer(request)
  }

  async ackCursor(request: AckCursorRequest): Promise<void> {
    this.ackRequests.push(request)
  }
}

const EMPTY_PAGE: PullResponse = {
  changes: [],
  cursors: {},
  scopes: [],
  checksums: {},
  hasMore: false,
}

interface Device {
  readonly engine: SyncEngine
  readonly db: IDatabase
}

async function engineOver(client: ISyncClient): Promise<Device> {
  const { db } = await openTestDatabase()

  const engine = createSyncEngine({
    db,
    client,
    deviceId: async () => DEVICE,
    ownerId: () => OWNER,
    now: () => '2026-09-18T00:00:00.000Z' as never,
    nowMs: () => 1_789_689_600_000,
    random: () => 0.5,
  })

  return { engine, db }
}

/** Every outbox row as the table holds it, answered ones included. */
const outboxReasons = (db: IDatabase): Promise<{ reason: string | null }[]> =>
  db.query<{ reason: string | null }>('SELECT reason FROM outbox ORDER BY id ASC')

describe('reading a pull page as the contract prints it', () => {
  it('pull-page — every row lands and every position moves to what the answer says', async () => {
    const page = pullPage.response as unknown as PullResponse
    const client = new FixtureClient(page)
    const { engine } = await engineOver(client)

    const result = await engine.pull()

    expect(result.applied).toBe(page.changes.length)

    // Compared as a whole rather than scope by scope. A loop over the fixture's
    // own keys asserts nothing at all if the fixture ever loses its `cursors`:
    // the body would simply not run, and the case would stay green while the
    // device stored no position whatsoever.
    const scopes = await engine.state.listScopes()
    const stored = Object.fromEntries(
      scopes.map((scope) => [
        syncScopeKey(scope.scope),
        { cursor: scope.cursor, checksum: scope.checksum },
      ]),
    )
    const promised = Object.fromEntries(
      Object.entries(page.cursors).map(([key, cursor]) => [
        key,
        { cursor, checksum: page.checksums[key as never] ?? null },
      ]),
    )

    expect(stored).toEqual(promised)

    // `hasMore` is true, and the second page repeats itself, so the guard that
    // stops a loop with no progress is what ends the run.
    expect(client.pullRequests.length).toBe(2)
  })

  it('pull-new-scope — a course with no local position is started at zero and fetched', async () => {
    const page = pullNewScope.response as unknown as PullResponse
    const { engine } = await engineOver(new FixtureClient(page))

    const result = await engine.pull()

    expect(result.added.map(syncScopeKey).sort()).toEqual(
      page.scopes.map((grant) => syncScopeKey(grant.scope)).sort(),
    )
    expect(await engine.courses.list()).toHaveLength(1)

    // There is no backfill endpoint and no backfill call: this was the pull.
    expect(result.applied).toBe(1)
  })

  it('optional-fields — a tombstone, an all-null row and an empty grant list all read', async () => {
    const page = optionalFields.response as unknown as PullResponse
    const { engine } = await engineOver(new FixtureClient(page))

    const result = await engine.pull()

    expect(result.applied).toBe(page.changes.length)
    expect(result.removed).toEqual([])

    const enrollments = await engine.enrollments.list()
    expect(enrollments).toHaveLength(1)
    expect(enrollments[0]).toMatchObject({ groupId: null, decidedById: null, decidedAt: null })
  })
})

describe('reading a push answer as the contract prints it', () => {
  /** Re-keys a fixture's answers onto the rows this device actually journaled. */
  const relabel =
    (results: readonly PushResult[]) =>
    (request: PushRequest): PushResponse => ({
      results: request.changes.map((change, index) => ({
        ...(results[index % results.length] as PushResult),
        outboxId: change.outboxId,
        collection: change.collection,
        docId: change.docId,
      })),
      journaledOutboxId: request.changes.at(-1)?.outboxId ?? 0,
    })

  const seed = async (engine: SyncEngine, count: number): Promise<void> => {
    for (let index = 0; index < count; index += 1) {
      await engine.blockStates.save({
        id: blockStateId(index),
        schoolId: '5c1f2e73-9a48-4c1d-b0e6-8f3a2d7c4915' as never,
        enrollmentId: '3a5c7e92-4b18-4d06-9f2e-1c8b6d4a3f57' as never,
        lessonVersionId: 'a41c7d02-33b5-4e8f-9c6a-71e204f5d8b3' as never,
        blockId: blockStateId(index) as never,
        state: { watched: index },
      })
    }
  }

  it('push-mixed — accepted and rejected sit side by side and each lands on its own row', async () => {
    const results = pushMixed.response.results as unknown as PushResult[]
    const client = new FixtureClient(EMPTY_PAGE, relabel(results))
    const { engine } = await engineOver(client)
    await seed(engine, results.length)

    const result = await engine.push()

    expect(result.accepted).toBe(results.filter((row) => row.status === 'accepted').length)
    expect(result.rejected).toBe(results.filter((row) => row.status === 'rejected').length)

    const rows = await engine.outbox.listPending({ ownerId: OWNER })
    expect(rows).toHaveLength(0)
  })

  it('push-rejections — every reason in the contract is stored on the row it belongs to', async () => {
    const results = pushRejections.response.results as unknown as PushResult[]
    const reasons = results.map((row) => (row as { reason: SyncRejectionReason }).reason)
    const client = new FixtureClient(EMPTY_PAGE, relabel(results))
    const { engine, db } = await engineOver(client)
    await seed(engine, results.length)

    await engine.push()

    expect((await outboxReasons(db)).map((row) => row.reason)).toEqual(reasons)

    // And the work is still here — a refusal is a state of the row, not a loss.
    expect(
      await engine.blockStates.getByKey({
        enrollmentId: '3a5c7e92-4b18-4d06-9f2e-1c8b6d4a3f57' as never,
        lessonVersionId: 'a41c7d02-33b5-4e8f-9c6a-71e204f5d8b3' as never,
        blockId: blockStateId(0) as never,
      }),
    ).not.toBeNull()
  })

  it('push-restamped — the HLC the server assigned becomes the document pointer', async () => {
    const results = pushRestamped.response.results as unknown as PushResult[]
    const client = new FixtureClient(EMPTY_PAGE, relabel(results))
    const { engine } = await engineOver(client)
    await seed(engine, results.length)

    await engine.push()

    const accepted = results.filter((row) => row.status === 'accepted')
    for (let index = 0; index < accepted.length; index += 1) {
      const pointer = await engine.apply.lastServerHlc('block_states', blockStateId(index))
      expect(pointer).toBe((accepted[index] as { serverHlc: string }).serverHlc)
    }
  })

  it('an answer that does not match the batch is refused rather than guessed at', async () => {
    const client = new FixtureClient(EMPTY_PAGE, () => ({
      results: [],
      journaledOutboxId: 0,
    }))
    const { engine } = await engineOver(client)
    await seed(engine, 1)

    await expect(engine.push()).rejects.toThrow(/answered 0 rows/)

    // Nothing was marked, so the row is still there to be sent again.
    expect(await engine.outbox.listPending({ ownerId: OWNER })).toHaveLength(1)
  })
})

describe('the row the natural key already held', () => {
  const request = pushNaturalKey.request as unknown as PushRequest
  const expected = pushNaturalKey.response as unknown as PushResponse

  /** What the fixture's answer says the row was written under. */
  const serverDocId = (expected.results[0] as { serverDocId: string }).serverDocId

  it('push-natural-key — the fake server answers it exactly as the contract prints it', async () => {
    const server = new FakeSyncServer()
    server.serverNowMs = 1_789_729_700_000
    server.journal({
      collection: 'homework',
      docId: serverDocId,
      scope: COURSE_SCOPE,
      data: { ...request.changes[0]!.data, id: serverDocId, text: 'written on the phone' },
      deviceId: 'device-phone',
    })

    expect(await server.push(request)).toEqual(expected)
  })

  it('push-natural-key — the device takes the name the answer gives it', async () => {
    const client = new FixtureClient(EMPTY_PAGE, (sent) => ({
      results: sent.changes.map((change) => ({
        ...(expected.results[0] as PushResult),
        outboxId: change.outboxId,
        collection: change.collection,
        docId: change.docId,
      })),
      journaledOutboxId: sent.changes.at(-1)?.outboxId ?? 0,
    }))
    const { engine, db } = await engineOver(client)
    const sent = request.changes[0]!

    await engine.homework.saveAnswer({
      id: sent.docId as never,
      schoolId: '5c1f2e73-9a48-4c1d-b0e6-8f3a2d7c4915' as never,
      enrollmentId: sent.data!.enrollmentId as never,
      lessonVersionId: sent.data!.lessonVersionId as never,
      sectionId: sent.data!.sectionId as never,
      text: sent.data!.text as string,
    })

    await engine.push()

    const rows = await db.query<{ id: string }>('SELECT id FROM homework')
    expect(rows.map((row) => row.id)).toEqual([serverDocId])
    expect(await engine.apply.lastServerHlc('homework', serverDocId)).toBe(
      (expected.results[0] as { serverHlc: string }).serverHlc,
    )
  })
})

const blockStateId = (index: number): string =>
  `4e8a1c93-7b25-4f60-8d31-2a9c5e0b7f${String(40 + index).padStart(2, '0')}`
