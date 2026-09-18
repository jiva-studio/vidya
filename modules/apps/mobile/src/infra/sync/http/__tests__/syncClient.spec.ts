import { Routes } from '@vidya/protocol'
import { isSyncTransportError } from '@vidya/usecases'
import { describe, expect, it } from 'vitest'

import { type HttpClient, HttpError, OfflineError } from '@/ports'

import { createHttpSyncClient } from '../syncClient'

/**
 * The wire adapter.
 *
 * Small on purpose: the interesting behaviour is the mapping from a transport
 * failure to a decision the run can act on, and above all the one mapping that
 * is a data-loss bug if it is wrong — a `401` must become "renew the token",
 * never "end the session" (D-10, AC-22f).
 */

const routes = Routes().sync

class RecordingHttp implements HttpClient {
  readonly calls: { path: string; body: unknown }[] = []

  constructor(private readonly thrown?: unknown) {}

  async post<TResponse>(path: string, body?: unknown): Promise<TResponse> {
    this.calls.push({ path, body })
    if (this.thrown !== undefined) throw this.thrown
    return { results: [], journaledOutboxId: 0 } as TResponse
  }

  get<TResponse>(): Promise<TResponse> {
    throw new Error('not used')
  }

  patch<TResponse>(): Promise<TResponse> {
    throw new Error('not used')
  }

  async delete(): Promise<void> {
    throw new Error('not used')
  }
}

const failureOf = async (thrown: unknown): Promise<string> => {
  const client = createHttpSyncClient({ http: new RecordingHttp(thrown) })
  try {
    await client.push({ deviceId: 'device-a', changes: [] })
    return 'no failure'
  } catch (error) {
    return isSyncTransportError(error) ? error.failure : 'passed through'
  }
}

describe('the sync wire adapter', () => {
  it('posts each call to the route the contract names', async () => {
    const http = new RecordingHttp()
    const client = createHttpSyncClient({ http })

    await client.pull({ deviceId: 'device-a', cursors: {} })
    await client.push({ deviceId: 'device-a', changes: [] })
    await client.ackCursor({ deviceId: 'device-a', ackedSeq: 7 })

    expect(http.calls.map((call) => call.path)).toEqual([
      routes.pull(),
      routes.push(),
      routes.cursor(),
    ])
  })

  it('D-10: a 401 asks for the token to be renewed, and never ends the session', async () => {
    expect(await failureOf(new HttpError(401, routes.push()))).toBe('unauthorized')
  })

  it('a 429 leads to a wait', async () => {
    expect(await failureOf(new HttpError(429, routes.push()))).toBe('rateLimited')
  })

  it('a 5xx stops the run', async () => {
    expect(await failureOf(new HttpError(500, routes.push()))).toBe('server')
    expect(await failureOf(new HttpError(503, routes.push()))).toBe('server')
  })

  it('any other 4xx is a refusal of the request itself', async () => {
    expect(await failureOf(new HttpError(400, routes.push()))).toBe('refused')
    expect(await failureOf(new HttpError(403, routes.push()))).toBe('refused')
  })

  it('a request that never left the device is unreachable, not a refusal', async () => {
    expect(await failureOf(new OfflineError(routes.push()))).toBe('unreachable')
  })

  it('an error it does not recognise travels up as itself', async () => {
    expect(await failureOf(new TypeError('something else entirely'))).toBe('passed through')
  })
})
