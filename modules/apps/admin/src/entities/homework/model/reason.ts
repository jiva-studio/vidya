import { HttpError, OfflineError } from '@/shared/api'

/**
 * What a screen shows when a request about a piece of work fails.
 *
 * The server's own sentence when it gave one — "Cannot move work from accepted
 * to returned" is the answer to the reviewer's question — and a shared Fluent
 * key when it did not.
 */
export const reason = (failure: unknown): string => {
  if (failure instanceof OfflineError) return 'error-offline'
  if (failure instanceof HttpError) return failure.reason ?? 'state-error'
  return 'state-error'
}
