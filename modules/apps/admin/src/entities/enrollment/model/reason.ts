import { HttpError, OfflineError } from '@/shared/api'

/**
 * What a screen shows when a request about an enrolment fails.
 *
 * The server's own sentence when it gave one — "has already been decided" is
 * the difference between a bug and two people moderating the same queue — and
 * a shared Fluent key when it did not.
 */
export const reason = (failure: unknown): string => {
  if (failure instanceof OfflineError) return 'error-offline'
  if (failure instanceof HttpError) return failure.reason ?? 'state-error'
  return 'state-error'
}
