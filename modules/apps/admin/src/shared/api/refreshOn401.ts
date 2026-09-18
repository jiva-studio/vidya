import { isUnauthorized } from './errors'
import type { HttpClient, HttpQuery, RefreshOn401Options } from './types'

/**
 * Renews the session when the server stops accepting the access token.
 *
 * One refresh is shared by every caller that hits a 401 at the same time: a
 * screen that opens six lists would otherwise fire six refreshes, five of which
 * race to replace the token the sixth just stored, and the loser's retry fails
 * with the very status it was sent to fix.
 *
 * A request is retried exactly once. A 401 on that retry is not a reason to
 * refresh again — the token is fresh, so the refusal is about the caller, and
 * repeating it is how a sign-in loop starts.
 */
export const refreshOn401 = (client: HttpClient, options: RefreshOn401Options): HttpClient => {
  let inFlight: Promise<boolean> | undefined

  const refreshOnce = (): Promise<boolean> => {
    if (inFlight) return inFlight

    const attempt = options
      .refresh()
      // A refresh that throws is a refresh that failed; callers only need the verdict.
      .catch(() => false)
      .finally(() => {
        inFlight = undefined
      })

    inFlight = attempt
    return attempt
  }

  const retryOnce = async <TResult>(call: () => Promise<TResult>): Promise<TResult> => {
    try {
      return await call()
    } catch (error) {
      if (isUnauthorized(error)) await options.endSession()
      throw error
    }
  }

  const guard = async <TResult>(call: () => Promise<TResult>): Promise<TResult> => {
    try {
      return await call()
    } catch (error) {
      if (!isUnauthorized(error)) throw error

      const renewed = await refreshOnce()
      if (!renewed) {
        await options.endSession()
        throw error
      }

      return retryOnce(call)
    }
  }

  return {
    get: <TResponse>(path: string, query?: HttpQuery) =>
      guard(() => client.get<TResponse>(path, query)),
    post: <TResponse>(path: string, body?: unknown) =>
      guard(() => client.post<TResponse>(path, body)),
    patch: <TResponse>(path: string, body?: unknown) =>
      guard(() => client.patch<TResponse>(path, body)),
    delete: (path: string) => guard(() => client.delete(path)),
  }
}
