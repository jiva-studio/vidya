import { HttpError, isUnauthorized, OfflineError } from './errors'
import type { Failure, FailureSink, HttpClient, HttpQuery, RequestOptions } from './types'

/** What a screen shows for a failure, as a Fluent key rather than a sentence. */
const Messages: Record<number, string> = {
  403: 'failure-forbidden',
  404: 'failure-missing',
  409: 'failure-conflict',
  422: 'failure-rejected',
  429: 'failure-too-many',
}

/**
 * Turns a failure into the one line an operator is shown.
 *
 * The server's own reason travels with it where it gave one: `{ message }` from
 * a domain rule names the thing that is wrong, which no phrasing of ours can.
 */
export const describe = (error: unknown): Failure => {
  if (error instanceof OfflineError) return { key: 'failure-offline' }
  if (!(error instanceof HttpError)) return { key: 'failure-unknown' }

  return { key: Messages[error.status] ?? 'failure-server', reason: error.reason }
}

let sink: FailureSink = () => {}

/**
 * Where failures are shown, set once as the application starts.
 *
 * The transport is built before there is a screen to show anything on, and a
 * story or a test may have none at all, so the sink is registered rather than
 * required.
 */
export const onFailure = (next: FailureSink): void => {
  sink = next
}

export const reportFailure: FailureSink = (failure) => sink(failure)

/**
 * Reports every failed request to one place, and lets it through unchanged.
 *
 * A caller still catches what it must act on — a form marks its own field, a
 * save offers to retry — but whether the operator is told at all is settled
 * here rather than screen by screen. A 401 says nothing: the session is being
 * renewed under the caller, and an expiry that fixed itself is not news.
 */
export const announceFailures = (client: HttpClient, report: FailureSink): HttpClient => {
  const watched = async <TResult>(call: () => Promise<TResult>): Promise<TResult> => {
    try {
      return await call()
    } catch (error) {
      if (!isUnauthorized(error)) report(describe(error))
      throw error
    }
  }

  return {
    get: <TResponse>(path: string, query?: HttpQuery, options?: RequestOptions) =>
      options?.quiet
        ? client.get<TResponse>(path, query, options)
        : watched(() => client.get<TResponse>(path, query, options)),
    post: <TResponse>(path: string, body?: unknown) =>
      watched(() => client.post<TResponse>(path, body)),
    patch: <TResponse>(path: string, body?: unknown) =>
      watched(() => client.patch<TResponse>(path, body)),
    delete: (path: string) => watched(() => client.delete(path)),
  }
}
