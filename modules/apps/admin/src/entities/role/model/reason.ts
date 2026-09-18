import { HttpError, OfflineError } from '@/shared/api'

/**
 * What a screen shows when a request fails: the server's own sentence when it
 * gave one, a shared Fluent key when it did not.
 */
export const reason = (failure: unknown): string => {
  if (failure instanceof OfflineError) return 'error-offline'
  if (failure instanceof HttpError) return failure.reason ?? 'state-error'
  return 'state-error'
}
