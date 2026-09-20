import type { $Fetch, FetchError, FetchOptions } from 'ofetch'
import { ofetch } from 'ofetch'

import { HttpError, OfflineError } from './errors'
import type { FetchHttpClientOptions, HttpClient, HttpQuery } from './types'

/** How long a screen waits for an answer before it is told there is none. */
const TimeoutMs = 15_000

/** A read is attempted again this many times; a write, never on its own. */
const ReadAttempts = 2

const RetryDelayMs = 300

/** Statuses that say the request failed on the way rather than on its merits. */
const Transient = [408, 425, 429, 500, 502, 503, 504]

/**
 * The only place in the application that knows how a request is made.
 *
 * The retrying, the backoff and the deadline are `ofetch`'s: a hand-written
 * loop around `fetch` is the same code with our own bugs in it. What is ours is
 * the line between a read and a write — a read that timed out can be asked
 * again, a write may already have been carried out, and asking again would
 * enrol a student twice.
 */
export class FetchHttpClient implements HttpClient {
  private readonly call: $Fetch

  constructor(private readonly options: FetchHttpClientOptions) {
    this.call = ofetch.create({
      baseURL: options.baseUrl,
      timeout: TimeoutMs,
      retryDelay: RetryDelayMs,
      retryStatusCodes: Transient,
      headers: { accept: 'application/json' },
      onRequest: ({ options: request }) => {
        const token = this.options.accessToken()
        if (token) request.headers.set('authorization', `Bearer ${token}`)
      },
    })
  }

  get<TResponse>(path: string, query?: HttpQuery): Promise<TResponse> {
    return this.send<TResponse>(path, { method: 'GET', query, retry: ReadAttempts })
  }

  post<TResponse>(path: string, body?: unknown): Promise<TResponse> {
    return this.send<TResponse>(path, { method: 'POST', body: payload(body) })
  }

  patch<TResponse>(path: string, body?: unknown): Promise<TResponse> {
    return this.send<TResponse>(path, { method: 'PATCH', body: payload(body) })
  }

  async delete(path: string): Promise<void> {
    await this.send<unknown>(path, { method: 'DELETE' })
  }

  private async send<TResponse>(path: string, request: FetchOptions<'json'>): Promise<TResponse> {
    try {
      return await this.call<TResponse>(path, { retry: false, ...request })
    } catch (error) {
      throw translate(path, error as FetchError)
    }
  }
}

/** The transport takes an object or nothing; what a caller hands over is its own. */
const payload = (body: unknown): Record<string, unknown> | undefined =>
  body === undefined ? undefined : (body as Record<string, unknown>)

/**
 * A refusal and an unreachable server are different failures.
 *
 * `ofetch` reports both as one error; a refusal carries the response the server
 * sent, and a request that never arrived carries nothing to show.
 */
const translate = (path: string, error: FetchError): Error => {
  const status = error.response?.status
  return status ? new HttpError(status, path, error.data) : new OfflineError(path)
}
