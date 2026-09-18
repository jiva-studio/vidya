/**
 * A response the server refused.
 *
 * The parsed body travels with the status because the screens have to show the
 * reason the server gave rather than a generic failure.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly body?: unknown,
  ) {
    super(`${path} answered ${status}`)
    this.name = 'HttpError'
  }

  /**
   * The reason the server gave, when it gave one.
   *
   * Nest answers a refusal with `{ message }`, where the message is a string
   * for a domain rule and an array for a failed validation.
   */
  get reason(): string | undefined {
    const message = (this.body as { message?: unknown } | undefined)?.message
    if (typeof message === 'string') return message
    if (Array.isArray(message)) return message.join(', ')
    return undefined
  }
}

/** The session is gone or was never valid — the caller must sign in again. */
export const isUnauthorized = (error: unknown): boolean =>
  error instanceof HttpError && error.status === 401

/** The server refused because a code it already sent is still alive. */
export const isTooManyRequests = (error: unknown): boolean =>
  error instanceof HttpError && error.status === 429

/** The request never left the browser. */
export class OfflineError extends Error {
  constructor(readonly path: string) {
    super(`${path} could not be reached`)
    this.name = 'OfflineError'
  }
}
