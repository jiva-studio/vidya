import { HttpError, OfflineError } from '@/shared/api'

/**
 * What a screen shows when a request fails.
 *
 * The server's own sentence is preferred over a house style: "A school with
 * this name already exists" tells the operator what to do, "Something went
 * wrong" does not. When there is no sentence, a shared Fluent key stands in,
 * and the screens render the result through `$t`, which passes text it does
 * not recognise straight through.
 */
export const reason = (failure: unknown): string => {
  if (failure instanceof OfflineError) return 'error-offline'
  if (failure instanceof HttpError) return failure.reason ?? 'state-error'
  return 'state-error'
}
