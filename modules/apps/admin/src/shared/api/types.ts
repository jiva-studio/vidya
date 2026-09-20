// The transport the application is allowed to know about. Adapters implement
// it, features depend on it. Nothing here mentions fetch, Vue or the router.

export type HttpQuery = Record<string, string | number | boolean | undefined>

export interface HttpClient {
  get<TResponse>(path: string, query?: HttpQuery): Promise<TResponse>
  post<TResponse>(path: string, body?: unknown): Promise<TResponse>
  patch<TResponse>(path: string, body?: unknown): Promise<TResponse>
  delete(path: string): Promise<void>
}

export interface FetchHttpClientOptions {
  readonly baseUrl: string
  readonly accessToken: () => string | undefined
}

/** A failure as the operator will read it: a Fluent key, and the server's words. */
export interface Failure {
  readonly key: string
  readonly reason?: string
}

export type FailureSink = (failure: Failure) => void

export interface RefreshOn401Options {
  /** Trades the stored refresh token for a new session. `false` means it could not. */
  readonly refresh: () => Promise<boolean>

  /** Called once the session is beyond saving. */
  readonly endSession: () => void | Promise<void>
}
