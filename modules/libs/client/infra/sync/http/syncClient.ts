import type {
  AckCursorRequest,
  PullRequest,
  PullResponse,
  PushRequest,
  PushResponse,
} from '@vidya/protocol'
import { Routes } from '@vidya/protocol'
import { type ISyncClient, SyncTransportError, type SyncTransportFailure } from '@vidya/usecases'

import { type HttpClient, HttpError, OfflineError } from '../../../ports'

/**
 * The sync wire, over HTTP.
 *
 * Two things about this adapter are not incidental.
 *
 * **It must not be built on the app's default client.** `useApi()` wraps
 * `endSessionOn401`, which ends the session on any `401`, so a sync run meeting
 * an expired token would sign the student out and take away a course already
 * sitting on their phone. The composition passes a bare `FetchHttpClient`; the
 * run refreshes the token itself and defers if it cannot.
 *
 * **It translates failures into the four things a run can do about them.** A
 * status code above this layer would be transport knowledge in a place that has
 * no transport, so `401` becomes `unauthorized`, `429` becomes `rateLimited`,
 * `5xx` becomes `server`, anything unreachable becomes `unreachable`, and the
 * rest becomes `refused`.
 */

export interface HttpSyncClientOptions {
  readonly http: HttpClient
}

export function createHttpSyncClient(options: HttpSyncClientOptions): ISyncClient {
  const routes = Routes().sync

  return {
    pull: (request: PullRequest) => send<PullResponse>(options.http, routes.pull(), request),

    push: (request: PushRequest) => send<PushResponse>(options.http, routes.push(), request),

    ackCursor: async (request: AckCursorRequest) => {
      await send<void>(options.http, routes.cursor(), request)
    },
  }
}

async function send<TResponse>(http: HttpClient, path: string, body: unknown): Promise<TResponse> {
  try {
    return await http.post<TResponse>(path, body)
  } catch (error) {
    throw toTransportError(error, path)
  }
}

/**
 * Turn whatever the transport threw into a decision the run can act on.
 *
 * An error this adapter does not recognise is not disguised as one it does: it
 * travels up as itself, and the run treats an unknown failure as a reason to
 * back off rather than as a reason to pretend it understood.
 */
export function toTransportError(error: unknown, path: string): unknown {
  if (error instanceof OfflineError) {
    return new SyncTransportError('unreachable', `${path} could not be reached`)
  }

  if (error instanceof HttpError) {
    return new SyncTransportError(failureFor(error.status), `${path} answered ${error.status}`)
  }

  return error
}

function failureFor(status: number): SyncTransportFailure {
  if (status === 401) return 'unauthorized'
  if (status === 429) return 'rateLimited'
  if (status >= 500) return 'server'

  return 'refused'
}
