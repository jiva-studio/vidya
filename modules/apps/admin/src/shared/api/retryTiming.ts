/** The wait before the second attempt; each further one doubles it. */
export const RetryDelayMs = 300

/** The longest wait a server may ask a request to be held open for. */
export const MaxRetryAfterMs = 30_000

/**
 * What the server asked the client to wait, in milliseconds.
 *
 * `Retry-After` is either a count of seconds or an HTTP date. A server asking
 * for longer than the ceiling is telling the operator to come back later, not
 * the client to hold a request open, so the wait is capped rather than
 * honoured; a header that parses as neither is ignored.
 */
export const retryAfterMs = (
  header: string | null | undefined,
  now: number,
): number | undefined => {
  if (!header) return undefined

  const seconds = Number(header)
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - now

  return Number.isNaN(ms) ? undefined : Math.max(0, Math.min(ms, MaxRetryAfterMs))
}

/**
 * How long to wait when the server said nothing about it.
 *
 * Each attempt waits longer than the one before: a server that is restarting is
 * not back in three hundred milliseconds, and a second attempt in the same
 * moment as the first is a second attempt into the same outage. `remaining` is
 * what the transport has left, which is how far along the attempts we are.
 */
export const backoffMs = (remaining: number, attempts: number): number => {
  const taken = Math.max(0, attempts - Math.max(0, Math.min(remaining, attempts)))
  return RetryDelayMs * 2 ** taken
}
