import { HttpError, isUnauthorized, OfflineError } from './errors'
import type { Failure, FailureSink, HttpClient, HttpQuery } from './types'

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
 * Callers still catch what they must act on — a form that marks its own field,
 * a save that offers to retry. What they no longer do is decide whether the
 * operator is told at all: that answer was different on every screen, and on
 * most of them it was a line of red text somewhere down the page.
 *
 * A 401 says nothing: the session is being renewed under the caller, and an
 * expiry that fixed itself is not news.
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
    get: <TResponse>(path: string, query?: HttpQuery) =>
      watched(() => client.get<TResponse>(path, query)),
    post: <TResponse>(path: string, body?: unknown) =>
      watched(() => client.post<TResponse>(path, body)),
    patch: <TResponse>(path: string, body?: unknown) =>
      watched(() => client.patch<TResponse>(path, body)),
    delete: (path: string) => watched(() => client.delete(path)),
  }
}
