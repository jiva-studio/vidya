import { afterEach, beforeEach, describe, expect, it, type MockedFunction, vi } from 'vitest'

import { HttpError, OfflineError } from '../errors'
import { FetchHttpClient } from '../fetchHttpClient'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('FetchHttpClient', () => {
  let fetchMock: MockedFunction<typeof fetch>
  let token: string | undefined

  const client = () => new FetchHttpClient({ baseUrl: 'http://api.test', accessToken: () => token })

  const lastCall = () => fetchMock.mock.calls.at(-1) as [string, RequestInit]

  /** The transport carries headers as `Headers`, which has no own properties. */
  const sentHeader = (name: string) => new Headers(lastCall()[1].headers).get(name)

  beforeEach(() => {
    token = undefined
    fetchMock = vi.fn(async () => json({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('leaves undefined query parameters out of the address', async () => {
    await client().get('/edu/courses', { schoolId: 'a', page: 2, archived: false, q: undefined })

    expect(lastCall()[0]).toBe('http://api.test/edu/courses?schoolId=a&page=2&archived=false')
  })

  it('sends no query string at all when every parameter is undefined', async () => {
    await client().get('/edu/courses', { q: undefined })

    expect(lastCall()[0]).toBe('http://api.test/edu/courses')
  })

  it('authorises the request when a token is held', async () => {
    token = 'header.payload.signature'
    await client().get('/edu/courses')

    expect(sentHeader('authorization')).toBe('Bearer header.payload.signature')
  })

  it('sends no authorization header when there is no token', async () => {
    await client().get('/edu/courses')

    expect(sentHeader('authorization')).toBeNull()
  })

  it('attaches an x-request-id header for distributed tracing', async () => {
    await client().get('/edu/courses')
    expect(sentHeader('x-request-id')).toBeTruthy()
  })

  it('reads the token at call time rather than at construction', async () => {
    const http = client()
    token = 'later'
    await http.get('/edu/courses')

    expect(sentHeader('authorization')).toBe('Bearer later')
  })

  it('does not try to parse a 204 as JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(client().delete('/edu/courses/1')).resolves.toBeUndefined()
  })

  it('carries the refusal body so the screen can show the reason', async () => {
    fetchMock.mockResolvedValueOnce(json({ message: 'Course name is taken' }, 409))

    const error: unknown = await client()
      .post('/edu/courses', {})
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(HttpError)
    expect((error as HttpError).status).toBe(409)
    expect((error as HttpError).reason).toBe('Course name is taken')
  })

  it('joins a validation message list into one reason', async () => {
    fetchMock.mockResolvedValueOnce(json({ message: ['name must not be empty', 'bad id'] }, 400))

    const error = (await client()
      .post('/edu/courses', {})
      .catch((e: unknown) => e)) as HttpError

    expect(error.reason).toBe('name must not be empty, bad id')
  })

  it('turns a transport failure into an OfflineError, not an HttpError', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = (await client()
      .get('/edu/courses')
      .catch((e: unknown) => e)) as Error

    expect(error).toBeInstanceOf(OfflineError)
    expect(error).not.toBeInstanceOf(HttpError)
  })

  it('sends a JSON content type only when there is a body', async () => {
    await client().post('/auth/signout')
    expect(sentHeader('content-type')).toBeNull()

    await client().post('/auth/signout', { refreshToken: 'r' })
    expect(sentHeader('content-type')).toBe('application/json')
    expect(lastCall()[1].body).toBe('{"refreshToken":"r"}')
  })

  it('asks again when a read fails on the way, and answers with what it got', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(client().get('/edu/courses')).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('asks again when the server answers that it is unavailable', async () => {
    fetchMock.mockResolvedValueOnce(json({ message: 'restarting' }, 503))

    await expect(client().get('/edu/courses')).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  // A server that is restarting is not back in 300ms, and a second attempt in
  // the same moment as the first is a second attempt into the same outage.
  it('waits longer before each further attempt', async () => {
    const started = Date.now()
    fetchMock.mockImplementationOnce(async () => json({}, 503))
    fetchMock.mockImplementationOnce(async () => json({}, 503))

    await expect(client().get('/edu/courses')).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(Date.now() - started).toBeGreaterThanOrEqual(850)
  })

  // The header carries whole seconds, so the moment it names is up to a second
  // earlier than the one asked for; the wait is measured against that floor.
  it('reads a date in Retry-After as well as a count of seconds', async () => {
    const at = new Date(Date.now() + 2000).toUTCString()
    fetchMock.mockImplementationOnce(
      async () => new Response('{}', { status: 429, headers: { 'retry-after': at } }),
    )

    const started = Date.now()
    await expect(client().get('/edu/courses')).resolves.toEqual({ ok: true })
    expect(Date.now() - started).toBeGreaterThanOrEqual(1000)
  })

  it('falls back to its own wait when Retry-After is nonsense', async () => {
    fetchMock.mockImplementationOnce(
      async () => new Response('{}', { status: 429, headers: { 'retry-after': 'soon' } }),
    )

    const started = Date.now()
    await expect(client().get('/edu/courses')).resolves.toEqual({ ok: true })
    expect(Date.now() - started).toBeLessThan(800)
  })

  // The server says when to come back; a client that ignores it and asks again
  // in 300ms is what the status was sent to stop.
  it('waits as long as a refusal asked before it tries again', async () => {
    const started = Date.now()
    fetchMock.mockResolvedValueOnce(
      new Response('{}', { status: 429, headers: { 'retry-after': '1' } }),
    )

    await expect(client().get('/edu/courses')).resolves.toEqual({ ok: true })
    expect(Date.now() - started).toBeGreaterThanOrEqual(900)
  })

  // A write that timed out may well have been carried out: repeating it is how
  // a student is enrolled twice.
  it('never repeats a write on its own', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(client().post('/edu/courses', { name: 'A' })).rejects.toBeInstanceOf(OfflineError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
