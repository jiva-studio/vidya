import { INestApplication } from '@nestjs/common'
import { EnrollmentsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

import { createSyncContext, seedJournal, SyncContext } from './context'

const routes = protocol.Routes().sync

const DEVICE = 'device-8f2a6c14'

describe('POST /sync/pull', () => {
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

  const pull = (token: string, body: Partial<protocol.PullRequest>) =>
    request(app.getHttpServer())
      .post(routes.pull())
      .auth(token, { type: 'bearer' })
      .send({ deviceId: DEVICE, cursors: {}, ...body })

  const mine = (): domain.SyncScopeRef => ({ kind: 'course', id: ctx.mine.course.id })
  const own = (): domain.SyncScopeRef => ({ kind: 'user', id: ctx.student.id })

  /* ------------------------------- T-S-9 -------------------------------- */

  it('T-S-9: does not hand over another student user scope', async () => {
    await seedJournal(
      ds,
      { kind: 'user', id: ctx.stranger.id },
      { schoolId: ctx.schoolId, count: 3 },
    )

    const response = await pull(ctx.tokens.student, {
      cursors: { [`user:${ctx.stranger.id}`]: 0 },
    }).expect(200)

    const body = response.body as protocol.PullResponse

    expect(body.changes.filter((c) => c.scope.id === ctx.stranger.id)).toHaveLength(0)
    expect(body.scopes.map((g) => g.scope.id)).not.toContain(ctx.stranger.id)
  })

  /* ------------------------------- T-S-10 ------------------------------- */

  it('T-S-10: does not hand over a course the caller has no place on', async () => {
    const response = await pull(ctx.tokens.student, {
      cursors: { [`course:${ctx.theirs.course.id}`]: 0 },
    }).expect(200)

    const body = response.body as protocol.PullResponse

    expect(body.changes.filter((c) => c.scope.id === ctx.theirs.course.id)).toHaveLength(0)
  })

  /* ------------------------------- T-S-11 ------------------------------- */

  it('T-S-11: does not echo rows the calling device wrote', async () => {
    await seedJournal(ds, own(), { schoolId: ctx.schoolId, count: 2, deviceId: DEVICE })
    await seedJournal(ds, own(), { schoolId: ctx.schoolId, count: 2, from: 10 })

    const ours = await pull(ctx.tokens.student, {}).expect(200)
    const theirs = await pull(ctx.tokens.student, { deviceId: 'another-device' }).expect(200)

    const seeded = (body: protocol.PullResponse) =>
      body.changes.filter((change) => change.collection === 'block_states')

    expect(seeded(ours.body as protocol.PullResponse)).toHaveLength(2)
    expect(seeded(theirs.body as protocol.PullResponse)).toHaveLength(4)
  })

  /* ------------------------------- T-S-44 ------------------------------- */

  /**
   * D-1. The echo filter used to stop the cursor as well as the delivery: the
   * page advanced by the highest `serverSeq` it *returned*, and a scope whose
   * tail is the caller's own work returns nothing from that tail. The device's
   * own rows carry a `serverSeq` it is told nowhere else — `PushResult` names
   * the stamp, not the sequence — so the gap to `headSeq` never closed, no
   * matter how many times it pulled.
   */
  it('T-S-44: reaches headSeq even when the tail of the scope is its own work', async () => {
    await seedJournal(ds, own(), { schoolId: ctx.schoolId, count: 4 })
    await seedJournal(ds, own(), { schoolId: ctx.schoolId, count: 4, deviceId: DEVICE, from: 10 })

    const response = await pull(ctx.tokens.student, {}).expect(200)
    const body = response.body as protocol.PullResponse

    const key = domain.syncScopeKey(own())
    const grant = body.scopes.find((g) => domain.syncScopeKey(g.scope) === key)

    // Its own four rows are still not echoed back to it...
    expect(body.changes.filter((c) => c.collection === 'block_states')).toHaveLength(4)

    // ...and the scope is nonetheless up to date, in one pull.
    expect(body.hasMore).toBe(false)
    expect(body.cursors[key]).toBe(grant.headSeq)
  })

  /* ------------------------------- T-S-45 ------------------------------- */

  /**
   * The other half of D-1: echo and rights are different filters. A row the
   * caller never had a claim to was never delivered and must never be counted
   * as applied, so no position comes back for that scope at all — otherwise a
   * later enrolment would start above the history it is entitled to.
   */
  it('T-S-45: a scope refused for rights advances no cursor', async () => {
    const stranger: domain.SyncScopeRef = { kind: 'user', id: ctx.stranger.id }

    await seedJournal(ds, stranger, { schoolId: ctx.schoolId, count: 3 })

    const response = await pull(ctx.tokens.student, {
      cursors: { [domain.syncScopeKey(stranger)]: 0 },
    }).expect(200)

    const body = response.body as protocol.PullResponse

    expect(body.cursors[domain.syncScopeKey(stranger)]).toBeUndefined()
    expect(Object.keys(body.cursors)).not.toContain(domain.syncScopeKey(stranger))
  })

  /* ------------------------------- T-S-12 ------------------------------- */

  it('T-S-12: a position of zero hands over the scope from the beginning', async () => {
    const response = await pull(ctx.tokens.student, {
      cursors: { [domain.syncScopeKey(mine())]: 0 },
    }).expect(200)

    const body = response.body as protocol.PullResponse
    const course = body.changes.filter((c) => c.scope.id === ctx.mine.course.id)

    // The course, its lesson and the published version — and not the draft.
    expect(course.map((c) => c.collection)).toEqual(['courses', 'lessons', 'lesson_versions'])
  })

  /* ------------------------------- T-S-4 -------------------------------- */

  it('T-S-4: a draft version is not in the journal, so a pull cannot leak it', async () => {
    const response = await pull(ctx.tokens.student, {}).expect(200)
    const body = response.body as protocol.PullResponse

    const versions = body.changes.filter((c) => c.collection === 'lesson_versions')

    expect(versions).toHaveLength(1)
    expect(versions[0].docId).toBe(ctx.mine.published.id)
  })

  /* ------------------------------- T-S-13 ------------------------------- */

  it('T-S-13: a short page says there is more and carries the position it reached', async () => {
    await seedJournal(ds, own(), { schoolId: ctx.schoolId, count: 5 })

    const response = await pull(ctx.tokens.student, { limit: 2 }).expect(200)
    const body = response.body as protocol.PullResponse

    expect(body.changes).toHaveLength(2)
    expect(body.hasMore).toBe(true)

    const last = body.changes[body.changes.length - 1]
    expect(body.cursors[domain.syncScopeKey(last.scope)]).toBe(last.serverSeq)
  })

  /* ------------------------------- T-S-14 ------------------------------- */

  it('T-S-14: a limit above the ceiling is clamped, not honoured', async () => {
    await seedJournal(ds, own(), {
      schoolId: ctx.schoolId,
      count: protocol.SYNC_MAX_PULL_LIMIT + 5,
    })

    const response = await pull(ctx.tokens.student, { limit: 100_000 }).expect(200)
    const body = response.body as protocol.PullResponse

    expect(body.changes).toHaveLength(protocol.SYNC_MAX_PULL_LIMIT)
    expect(body.hasMore).toBe(true)
  })

  /* ------------------------------- T-S-15 ------------------------------- */

  it('T-S-15: the scopes returned are the places the student holds now', async () => {
    const before = await pull(ctx.tokens.student, {}).expect(200)

    expect((before.body as protocol.PullResponse).scopes.map((g) => g.scope.id).sort()).toEqual(
      [ctx.mine.course.id, ctx.student.id].sort(),
    )

    await app.get(EnrollmentsService).create({
      courseId: ctx.theirs.course.id,
      studentId: ctx.student.id,
      schoolId: ctx.schoolId,
      status: 'accepted',
    })

    const after = await pull(ctx.tokens.student, {}).expect(200)

    expect((after.body as protocol.PullResponse).scopes.map((g) => g.scope.id)).toContain(
      ctx.theirs.course.id,
    )
  })

  /* ------------------------------- T-S-16 ------------------------------- */

  it('T-S-16: a position past the end is an empty page, not an error', async () => {
    const response = await pull(ctx.tokens.student, {
      cursors: { [domain.syncScopeKey(mine())]: 999_999, [domain.syncScopeKey(own())]: 999_999 },
    }).expect(200)

    const body = response.body as protocol.PullResponse

    expect(body.changes).toHaveLength(0)
    expect(body.hasMore).toBe(false)
    expect(body.cursors).toEqual({})
  })

  /* ------------------------------- T-S-17 ------------------------------- */

  describe('T-S-17: a position that is not a position is refused with a code', () => {
    it('refuses a negative one', async () => {
      const response = await pull(ctx.tokens.student, {
        cursors: { [domain.syncScopeKey(mine())]: -1 },
      }).expect(400)

      expect(response.body.code).toBe('invalidCursor')
    })

    it('refuses one that is not a number', async () => {
      const response = await pull(ctx.tokens.student, {
        cursors: { [domain.syncScopeKey(mine())]: 'soon' as unknown as number },
      }).expect(400)

      expect(response.body.code).toBe('invalidCursor')
    })

    it('refuses a key that is not a scope', async () => {
      const response = await pull(ctx.tokens.student, {
        cursors: { 'planet:mars': 0 } as protocol.SyncCursors,
      }).expect(400)

      expect(response.body.code).toBe('invalidCursor')
    })
  })

  /* ------------------------------- T-S-18 ------------------------------- */

  it('T-S-18: refuses a caller with no token', () =>
    request(app.getHttpServer())
      .post(routes.pull())
      .send({ deviceId: DEVICE, cursors: {} })
      .expect(401))

  /* ------------------------------- T-S-32 ------------------------------- */

  it('T-S-32: a scope standing at zero hands over its whole history, in pages', async () => {
    await seedJournal(ds, mine(), { schoolId: ctx.schoolId, count: 7 })

    const collected: protocol.SyncChange[] = []
    let cursors: protocol.SyncCursors = {}

    for (let page = 0; page < 10; page += 1) {
      const response = await pull(ctx.tokens.student, { cursors, limit: 3 }).expect(200)
      const body = response.body as protocol.PullResponse

      collected.push(...body.changes)
      cursors = { ...cursors, ...body.cursors }

      if (!body.hasMore) break
    }

    // Three rows of course content, the enrolment, seven seeded ones, once each.
    expect(collected).toHaveLength(11)
    expect(new Set(collected.map((c) => c.serverSeq)).size).toBe(11)
  })

  /* ------------------------------- T-S-33 ------------------------------- */

  it('T-S-33: a scope outside the caller rights is ignored even when asked for', async () => {
    await seedJournal(
      ds,
      { kind: 'course', id: ctx.theirs.course.id },
      {
        schoolId: ctx.schoolId,
        count: 4,
      },
    )

    const response = await pull(ctx.tokens.student, {
      cursors: { [`course:${ctx.theirs.course.id}`]: 0, [domain.syncScopeKey(own())]: 0 },
    }).expect(200)

    const body = response.body as protocol.PullResponse

    expect(body.changes.every((c) => c.scope.id !== ctx.theirs.course.id)).toBe(true)
    expect(body.cursors[`course:${ctx.theirs.course.id}`]).toBeUndefined()
  })

  /* ------------------------------ T-S-34a ------------------------------- */

  it('T-S-34a: scope positions are independent', async () => {
    await seedJournal(ds, own(), { schoolId: ctx.schoolId, count: 3 })

    const first = await pull(ctx.tokens.student, { limit: 100 }).expect(200)
    const cursors = (first.body as protocol.PullResponse).cursors

    // Move only the user scope forward; the course scope keeps its place.
    const second = await pull(ctx.tokens.student, {
      cursors: { [domain.syncScopeKey(own())]: cursors[domain.syncScopeKey(own())] },
    }).expect(200)

    const body = second.body as protocol.PullResponse

    expect(body.changes.every((c) => c.scope.kind === 'course')).toBe(true)
    expect(body.changes.length).toBeGreaterThan(0)
  })

  /* ------------------------------- T-S-37 ------------------------------- */

  it('T-S-37: a new enrolment mid-run adds a scope without disturbing the pages', async () => {
    await seedJournal(ds, own(), { schoolId: ctx.schoolId, count: 4 })

    const first = await pull(ctx.tokens.student, { limit: 3 }).expect(200)
    const firstBody = first.body as protocol.PullResponse

    await app.get(EnrollmentsService).create({
      courseId: ctx.theirs.course.id,
      studentId: ctx.student.id,
      schoolId: ctx.schoolId,
      status: 'accepted',
    })

    const second = await pull(ctx.tokens.student, {
      cursors: firstBody.cursors,
      limit: 100,
    }).expect(200)
    const secondBody = second.body as protocol.PullResponse

    // Nothing from the first page comes back, and the new course is a scope at 0.
    const seen = new Set(firstBody.changes.map((c) => c.serverSeq))

    expect(secondBody.changes.every((c) => !seen.has(c.serverSeq))).toBe(true)
    expect(secondBody.scopes.map((g) => g.scope.id)).toContain(ctx.theirs.course.id)
    expect(secondBody.changes.some((c) => c.scope.id === ctx.theirs.course.id)).toBe(true)
  })

  /* ------------------------------- T-S-43 ------------------------------- */

  it('T-S-43: more scopes than the ceiling is refused with a reason', async () => {
    const cursors: Record<string, number> = {}

    for (let index = 0; index <= protocol.SYNC_MAX_SCOPES; index += 1) {
      cursors[`course:${index}`] = 0
    }

    const response = await pull(ctx.tokens.student, { cursors }).expect(400)

    expect(response.body.code).toBe('tooManyScopes')
    expect(response.body.message).toEqual([
      `at most ${protocol.SYNC_MAX_SCOPES} scopes per request`,
    ])
  })
})
