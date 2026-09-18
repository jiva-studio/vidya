import { type HttpClient, type HttpQuery, isUnauthorized } from '@/ports'

/**
 * Ends the session the moment the server stops accepting its token.
 *
 * Without this a student with an expired token sees "sign in again" on every
 * screen and has no way to do it: the stored session still looks valid, so the
 * router's guard keeps letting them through to screens that cannot load. The
 * decorator sits here rather than in the adapter because the adapter is not
 * allowed to know that a session exists.
 */
export const endSessionOn401 = (
  client: HttpClient,
  endSession: () => Promise<void>,
): HttpClient => {
  const guard = async <TResult>(call: () => Promise<TResult>): Promise<TResult> => {
    try {
      return await call()
    } catch (error) {
      if (isUnauthorized(error)) await endSession()
      throw error
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
