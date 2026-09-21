// The transport the app is allowed to know about. Adapters implement it; use
// cases depend on it. Nothing here mentions fetch, Capacitor or Ionic.

export type HttpQuery = Record<string, string | number | boolean | undefined>

export interface HttpClient {
  get<TResponse>(path: string, query?: HttpQuery): Promise<TResponse>
  post<TResponse>(path: string, body?: unknown): Promise<TResponse>
  patch<TResponse>(path: string, body?: unknown): Promise<TResponse>
  delete(path: string): Promise<void>
}

/** A response the server refused. `status` is what it refused with. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`${path} answered ${status}`)
    this.name = 'HttpError'
  }
}

/** The session is gone or was never valid — the caller must sign in again. */
export const isUnauthorized = (error: unknown): boolean =>
  error instanceof HttpError && error.status === 401

/** The request could not leave the device. */
export class OfflineError extends Error {
  constructor(readonly path: string) {
    super(`${path} could not be reached`)
    this.name = 'OfflineError'
  }
}
