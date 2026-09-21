import { type HttpClient, type HttpQuery, isUnauthorized } from '@vidya/client'

/**
 * Acts the moment a server stops accepting the token it was given.
 *
 * What "acts" means belongs to the caller, and since the app talks to several
 * servers it is never a global sign-out: a client is built for one connection,
 * and a refusal is that connection's state. Marking it as needing a new
 * sign-in leaves every other school running and leaves everything already on
 * the device readable — a token governs the network, not the disk.
 *
 * The decorator sits here rather than in the adapter because the adapter is
 * not allowed to know that a connection exists. The sync engine is not wrapped
 * in it at all: a run renews its own token and defers if it cannot.
 */
export const endSessionOn401 = (client: HttpClient, onRefused: () => Promise<void>): HttpClient => {
  const guard = async <TResult>(call: () => Promise<TResult>): Promise<TResult> => {
    try {
      return await call()
    } catch (error) {
      if (isUnauthorized(error)) await onRefused()
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
