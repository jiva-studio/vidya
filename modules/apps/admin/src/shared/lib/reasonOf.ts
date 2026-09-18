import { HttpError, OfflineError } from '@/shared/api'

/**
 * A refusal turned into something the screen can print.
 *
 * The server's own sentence is preferred over a house style: "A school with
 * this name already exists" tells the operator what to do, "Something went
 * wrong" does not. When there is no sentence — no connection, a bare 403, a
 * failure that never reached the wire — a Fluent key stands in. Fluent returns
 * an unknown key unchanged, so both travel through the same `$t` and the caller
 * never has to know which it got.
 */
export const reasonOf = (error: unknown, fallback = 'state-error'): string => {
  if (error instanceof OfflineError) return 'error-offline'
  if (error instanceof HttpError && error.status === 403) return 'error-forbidden'
  if (error instanceof HttpError && error.reason) return error.reason
  return fallback
}
