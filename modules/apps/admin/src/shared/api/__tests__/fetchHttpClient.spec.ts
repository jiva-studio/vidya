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

    expect(lastCall()[1].headers).toMatchObject({
      authorization: 'Bearer header.payload.signature',
    })
  })

  it('sends no authorization header when there is no token', async () => {
    await client().get('/edu/courses')

    expect(lastCall()[1].headers).not.toHaveProperty('authorization')
  })

  it('reads the token at call time rather than at construction', async () => {
    const http = client()
    token = 'later'
    await http.get('/edu/courses')

    expect(lastCall()[1].headers).toMatchObject({ authorization: 'Bearer later' })
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
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const error = (await client()
      .get('/edu/courses')
      .catch((e: unknown) => e)) as Error

    expect(error).toBeInstanceOf(OfflineError)
    expect(error).not.toBeInstanceOf(HttpError)
  })

  it('sends a JSON content type only when there is a body', async () => {
    await client().post('/auth/signout')
    expect(lastCall()[1].headers).not.toHaveProperty('content-type')

    await client().post('/auth/signout', { refreshToken: 'r' })
    expect(lastCall()[1].headers).toMatchObject({ 'content-type': 'application/json' })
    expect(lastCall()[1].body).toBe('{"refreshToken":"r"}')
  })
})
