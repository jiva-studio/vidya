/**
 * Conformance over the wire fixtures — ….
 *
 * The fixtures in `__fixtures__/sync/` are the contract in worked examples.
 * This suite proves they match the types in `sync.ts`; the server lane replays
 * the same files through HTTP and the device lane through its fake client, so a
 * contract that drifts on one side is caught here rather than when the parts
 * are first put together.
 */

import { compareHlcString, isIsoDateTime, parseHlc } from '@vidya/domain'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

import {
  isSyncCollection,
  isSyncRejectionReason,
  isSyncRequestErrorCode,
  PullResponse,
  PushRequest,
  PushResponse,
  Routes,
  SYNC_MAX_SCOPES,
  SyncChange,
  SyncRejectionReason,
  SyncRejectionReasons,
  SyncScopeKinds,
} from '../index'

const FIXTURES = join(__dirname, '..', '__fixtures__', 'sync')

type Fixture = {
  name: string
  endpoint: string
  description: string
  request?: unknown
  response?: unknown
  [key: string]: unknown
}

const read = <T>(file: string): T => JSON.parse(readFileSync(join(FIXTURES, file), 'utf8')) as T

const fixtureFiles = readdirSync(FIXTURES)
  .filter((file) => file.endsWith('.json') && file !== 'manifest.json')
  .sort()

const fixtures = fixtureFiles.map((file) => ({ file, body: read<Fixture>(file) }))

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

const expectChange = (change: SyncChange): void => {
  expect(typeof change.serverSeq).toBe('number')
  expect(change.serverSeq).toBeGreaterThan(0)
  expect(isSyncCollection(change.collection)).toBe(true)
  expect(['upsert', 'delete']).toContain(change.op)
  expect(typeof change.docId).toBe('string')
  expect(typeof change.hlc).toBe('string')
  expect(SyncScopeKinds).toContain(change.scope.kind)
  expect(typeof change.scope.id).toBe('string')
  expect(typeof change.schoolId).toBe('string')
  expect(isIsoDateTime(change.createdAt)).toBe(true)

  // A tombstone carries no payload, and an upsert always carries one.
  expect(change.data === null).toBe(change.op === 'delete')
}

const expectPullResponse = (response: PullResponse): void => {
  expect(Array.isArray(response.changes)).toBe(true)
  expect(Array.isArray(response.scopes)).toBe(true)
  expect(typeof response.hasMore).toBe('boolean')
  response.changes.forEach(expectChange)

  for (const [key, cursor] of Object.entries(response.cursors)) {
    expect(key).toMatch(/^(school|course|user):.+$/)
    expect(Number.isInteger(cursor)).toBe(true)
    expect(cursor).toBeGreaterThanOrEqual(0)
  }

  for (const [key, checksum] of Object.entries(response.checksums)) {
    expect(key).toMatch(/^(school|course|user):.+$/)
    expect(typeof checksum).toBe('string')
  }

  for (const grant of response.scopes) {
    expect(SyncScopeKinds).toContain(grant.scope.kind)
    expect(Number.isInteger(grant.headSeq)).toBe(true)
  }
}

const expectPushPair = (request: PushRequest, response: PushResponse): void => {
  expect(response.results).toHaveLength(request.changes.length)
  expect(Number.isInteger(response.journaledOutboxId)).toBe(true)

  request.changes.forEach((change, index) => {
    const result = response.results[index]

    // The answer is positional: same length, same order, row for row.
    expect(result.outboxId).toBe(change.outboxId)
    expect(result.collection).toBe(change.collection)
    expect(result.docId).toBe(change.docId)

    if (result.status === 'accepted') {
      expect(typeof result.serverHlc).toBe('string')
      expect(typeof result.restamped).toBe('boolean')
      return
    }

    expect(result.status).toBe('rejected')
    expect(isSyncRejectionReason(result.reason)).toBe(true)
  })
}

/** Every HLC-looking string anywhere in a fixture, found by field name. */
const collectHlcs = (value: unknown, found: string[] = []): string[] => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectHlcs(item, found))
    return found
  }
  if (value === null || typeof value !== 'object') return found

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (/hlc$/i.test(key) && typeof nested === 'string') found.push(nested)
    else collectHlcs(nested, found)
  }

  return found
}

/** Every instant in a fixture, found by the `*At` naming the wire uses. */
const collectInstants = (value: unknown, found: string[] = []): string[] => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectInstants(item, found))
    return found
  }
  if (value === null || typeof value !== 'object') return found

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (/(At|createdAt)$/.test(key) && typeof nested === 'string') found.push(nested)
    else collectInstants(nested, found)
  }

  return found
}

/* -------------------------------------------------------------------------- */
/* */
/* -------------------------------------------------------------------------- */

describe('the shape of a pull response', () => {
  it('reads pull-page as a PullResponse', () => {
    const fixture = read<{ response: PullResponse }>('pull-page.json')

    expectPullResponse(fixture.response)
    expect(fixture.response.hasMore).toBe(true)
    expect(fixture.response.changes).toHaveLength(3)
  })

  it('advances the position of each scope a page touched, and only those', () => {
    const fixture = read<{ response: PullResponse }>('pull-page.json')
    const touched = new Set(
      fixture.response.changes.map((change) => `${change.scope.kind}:${change.scope.id}`),
    )

    expect(new Set(Object.keys(fixture.response.cursors))).toEqual(touched)
  })

  it('reports the caller current scopes, headSeq included', () => {
    const fixture = read<{ response: PullResponse }>('pull-page.json')

    expect(fixture.response.scopes.length).toBeGreaterThan(0)
    expect(Object.keys(fixture.response.checksums).length).toBeGreaterThan(0)
  })
})

/* -------------------------------------------------------------------------- */
/* */
/* -------------------------------------------------------------------------- */

describe('the shape of a push response', () => {
  const pushFixtures = [
    'push-mixed.json',
    'push-rejections.json',
    'push-restamped.json',
    'push-natural-key.json',
  ]

  it.each(pushFixtures)('answers %s row by row, in order', (file) => {
    const fixture = read<{ request: PushRequest; response: PushResponse }>(file)

    expectPushPair(fixture.request, fixture.response)
  })

  it('lets an accepted row sit beside a refused one', () => {
    const fixture = read<{ response: PushResponse }>('push-mixed.json')
    const statuses = fixture.response.results.map((result) => result.status)

    expect(statuses).toEqual(['accepted', 'accepted', 'rejected'])
  })

  it('returns serverHlc on every accepted row, restamped or not', () => {
    const fixture = read<{ response: PushResponse }>('push-restamped.json')
    const accepted = fixture.response.results.filter((result) => result.status === 'accepted')

    expect(accepted).toHaveLength(2)
    expect(accepted.every((result) => result.status === 'accepted' && result.serverHlc)).toBe(true)
    expect(accepted.map((result) => result.status === 'accepted' && result.restamped)).toEqual([
      false,
      true,
    ])
  })

  it('names the row it wrote when that is not the row it was sent', () => {
    const fixture = read<{ request: PushRequest; response: PushResponse }>('push-natural-key.json')
    const [result] = fixture.response.results

    expect(result.status).toBe('accepted')
    expect(result.status === 'accepted' && result.serverDocId).toBeDefined()
    expect(result.status === 'accepted' && result.serverDocId).not.toBe(result.docId)

    // And `docId` is still the id the device sent, so the answer can be matched
    // to the row that produced it.
    expect(result.docId).toBe(fixture.request.changes[0].docId)
  })

  it('leaves serverDocId out when the server wrote under the id it was sent', () => {
    const fixture = read<{ response: PushResponse }>('push-mixed.json')

    for (const result of fixture.response.results) {
      expect(result.status === 'accepted' && 'serverDocId' in result).toBe(false)
    }
  })

  it('carries the write checkpoint back to the device', () => {
    const fixture = read<{ response: PushResponse }>('push-mixed.json')

    expect(fixture.response.journaledOutboxId).toBe(42)
  })
})

describe('every rejection reason is worked through somewhere', () => {
  it('covers the whole set, and invents nothing beside it', () => {
    const seen = new Set<SyncRejectionReason>()
    for (const { body } of fixtures) {
      const response = body.response as PushResponse | undefined
      for (const result of response?.results ?? []) {
        if (result.status === 'rejected') seen.add(result.reason)
      }
    }

    expect([...seen].sort()).toEqual([...SyncRejectionReasons].sort())
  })

  it('names a request-level code for the failures that are not per-row', () => {
    const fixture = read<{ cases: { code: string; statusCode: number }[] }>('request-errors.json')

    expect(fixture.cases.length).toBeGreaterThan(0)
    for (const problem of fixture.cases) {
      expect(isSyncRequestErrorCode(problem.code)).toBe(true)
      expect(problem.statusCode).toBe(400)
    }
    expect(fixture.cases.map((problem) => problem.code)).toContain('tooManyScopes')
    expect(SYNC_MAX_SCOPES).toBeGreaterThan(0)
  })
})

/* -------------------------------------------------------------------------- */
/* */
/* -------------------------------------------------------------------------- */

describe('optional and nullable fields read the same on both sides', () => {
  const fixture = read<{
    request: { limit?: number; cursors: Record<string, number> }
    response: PullResponse
    push: { request: PushRequest; response: PushResponse }
  }>('optional-fields.json')

  it('accepts a pull with no limit and no known positions', () => {
    expect(fixture.request.limit).toBeUndefined()
    expect(Object.keys(fixture.request.cursors)).toHaveLength(0)
    expectPullResponse(fixture.response)
  })

  it('reads a tombstone as data null and op delete', () => {
    const tombstone = fixture.response.changes.find((change) => change.op === 'delete')

    expect(tombstone).toBeDefined()
    expect(tombstone?.data).toBeNull()
  })

  it('keeps a null apart from an absent field', () => {
    const enrollment = fixture.response.changes.find(
      (change) => change.collection === 'enrollments',
    )

    expect(enrollment?.data).toMatchObject({ groupId: null, decidedById: null, decidedAt: null })
    expect(Object.keys(enrollment?.data ?? {})).toContain('groupId')
  })

  it('reads an empty page and an empty string without special-casing them', () => {
    expect(fixture.response.scopes).toEqual([])
    expect(fixture.response.hasMore).toBe(false)
    expect(fixture.push.request.changes[0].data).toMatchObject({ text: '', submittedAt: null })
    expectPushPair(fixture.push.request, fixture.push.response)
  })

  it('leaves detail off an accepted result', () => {
    const [result] = fixture.push.response.results

    expect(result).not.toHaveProperty('detail')
  })
})

/* -------------------------------------------------------------------------- */
/* */
/* -------------------------------------------------------------------------- */

describe('the HLC on the wire is the HLC in the domain', () => {
  it('parses every stamp in every fixture and round-trips it unchanged', () => {
    const stamps = fixtures.flatMap(({ body }) => collectHlcs(body))

    expect(stamps.length).toBeGreaterThan(0)
    for (const stamp of stamps) {
      const parsed = parseHlc(stamp)
      expect(stamp).toMatch(/^\d{15}:\d{5}:.+$/)
      expect(parsed.physical).toBeGreaterThan(0)
    }
  })

  it('orders padded strings the way the domain orders the values', () => {
    const fixture = read<{ ascending: string[] }>('hlc-format.json')

    for (let i = 1; i < fixture.ascending.length; i++) {
      expect(compareHlcString(fixture.ascending[i], fixture.ascending[i - 1])).toBeGreaterThan(0)
      expect(fixture.ascending[i] > fixture.ascending[i - 1]).toBe(true)
    }
  })

  it('keeps a device id that contains colons intact', () => {
    const fixture = read<{ samples: { hlc: string; deviceId: string }[] }>('hlc-format.json')
    const withColons = fixture.samples.find((sample) => sample.deviceId.includes(':'))

    expect(parseHlc(withColons?.hlc ?? '').deviceId).toBe('a:b:c')
  })

  // Д-17: every instant is UTC, milliseconds, always `Z`.
  it('carries every instant as a UTC ISO timestamp', () => {
    const instants = fixtures.flatMap(({ body }) => collectInstants(body))

    expect(instants.length).toBeGreaterThan(0)
    for (const instant of instants) {
      expect(isIsoDateTime(instant)).toBe(true)
    }
  })
})

/* -------------------------------------------------------------------------- */
/* */
/* -------------------------------------------------------------------------- */

describe('the cursor acknowledgement, and the endpoint that does not exist', () => {
  const fixture = read<{
    request: { deviceId: string; ackedSeq: number }
    status: number
    response: null
    absentEndpoints: string[]
  }>('cursor-ack.json')

  it('acknowledges a sequence and is answered with 204 and no body', () => {
    expect(typeof fixture.request.deviceId).toBe('string')
    expect(Number.isInteger(fixture.request.ackedSeq)).toBe(true)
    expect(fixture.status).toBe(204)
    expect(fixture.response).toBeNull()
  })

  it('has no backfill route, because a new scope is pulled from zero', () => {
    const routes = Routes('')

    expect(Object.keys(routes.sync).sort()).toEqual(['cursor', 'pull', 'push'])
    expect(JSON.stringify(routes)).not.toContain('backfill')
    expect(fixture.absentEndpoints).toContain('/sync/backfill')
  })

  it('brings the history of a scope standing at zero through an ordinary pull', () => {
    const newScope = read<{
      request: { cursors: Record<string, number> }
      response: PullResponse
    }>('pull-new-scope.json')
    const zeroed = Object.entries(newScope.request.cursors).filter(([, cursor]) => cursor === 0)

    expect(zeroed).toHaveLength(1)
    expectPullResponse(newScope.response)
    expect(newScope.response.changes[0].scope.id).toBe(zeroed[0][0].split(':')[1])
  })
})

/* -------------------------------------------------------------------------- */
/*                              The fixture set                               */
/* -------------------------------------------------------------------------- */

describe('the fixture set itself', () => {
  it('is described by the manifest, file for file', () => {
    const manifest = read<{ fixtures: { file: string }[] }>('manifest.json')

    expect(manifest.fixtures.map((entry) => entry.file).sort()).toEqual(fixtureFiles)
  })

  it('names a real collection in every row it carries', () => {
    for (const { body } of fixtures) {
      const response = body.response as PullResponse | undefined
      for (const change of response?.changes ?? []) {
        expect(isSyncCollection(change.collection)).toBe(true)
      }
    }
  })
})
