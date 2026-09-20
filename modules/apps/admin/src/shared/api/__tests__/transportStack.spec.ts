import { afterEach, beforeEach, describe, expect, it, type MockedFunction, vi } from 'vitest'

import { announceFailures } from '../failures'
import { FetchHttpClient } from '../fetchHttpClient'
import { refreshOn401 } from '../refreshOn401'
import type { Failure, HttpClient } from '../types'

/**
 * The three layers as the application stacks them, over a scripted `fetch`.
 *
 * Each layer is tested on its own next door. What only shows here is what they
 * do to each other: the retrying happens under the renewal, and the announcing
 * happens over both.
 */
const stack = (token: () => string | undefined) => {
  const said: Failure[] = []
  const refresh = vi.fn(async () => true)

  const client: HttpClient = announceFailures(
    refreshOn401(new FetchHttpClient({ baseUrl: 'http://api.test', accessToken: token }), {
      refresh,
      endSession: vi.fn(),
    }),
    (failure) => said.push(failure),
  )

  return { client, said, refresh }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('the transport as it is assembled', () => {
  let fetchMock: MockedFunction<typeof fetch>

  beforeEach(() => {
    fetchMock = vi.fn(async () => json({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // The retry reads the token again rather than carrying the one it started
  // with: a session renewed between the two attempts is renewed for both.
  it('carries the renewed token into the attempt that follows a refusal', async () => {
    let token = 'stale'
    const { client, refresh, said } = stack(() => token)

    fetchMock.mockImplementationOnce(async () => {
      token = 'fresh'
      return json({ message: 'expired' }, 401)
    })

    await expect(client.get('/edu/courses')).resolves.toEqual({ ok: true })

    const sent = fetchMock.mock.calls.map(([, init]) =>
      new Headers((init as RequestInit).headers).get('authorization'),
    )

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(sent).toEqual(['Bearer stale', 'Bearer fresh'])
    expect(said).toEqual([])
  })

  // A read that the transport carried through on its own is not a failure the
  // operator has to hear about.
  it('says nothing about an outage the retry rode out', async () => {
    const { client, said } = stack(() => 't')

    fetchMock.mockResolvedValueOnce(json({ message: 'restarting' }, 503))

    await expect(client.get('/edu/courses')).resolves.toEqual({ ok: true })
    expect(said).toEqual([])
  })

  it('announces an outage that outlasted every attempt', async () => {
    const { client, said } = stack(() => 't')

    // A fresh response per attempt: a body is read once, and the retry reads
    // the second one.
    fetchMock.mockImplementation(async () => json({ message: 'restarting' }, 503))

    await expect(client.get('/edu/courses')).rejects.toThrow()
    expect(said).toEqual([{ key: 'failure-server', reason: 'restarting' }])
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1)
  })

  // Six lists opened at once meet one expiry: the token is traded once, not
  // six times, and no screen is told the session blinked.
  it('renews the session once for every read that met the expiry', async () => {
    let token = 'stale'
    const { client, refresh, said } = stack(() => token)

    fetchMock.mockImplementation(async (...args) => {
      const sent = new Headers((args[1] as RequestInit).headers).get('authorization')
      if (sent === 'Bearer stale') {
        token = 'fresh'
        return json({ message: 'expired' }, 401)
      }
      return json({ ok: true })
    })

    const reads = ['/a', '/b', '/c', '/d', '/e', '/f'].map((path) => client.get(path))

    await expect(Promise.all(reads)).resolves.toHaveLength(6)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(said).toEqual([])
  })
})
