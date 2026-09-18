import { HttpError, OfflineError } from '@/shared/api'

/**
 * A refusal turned into something the screen can print.
 *
 * Either the reason the server gave or a Fluent key the template resolves;
 * Fluent returns an unknown key unchanged, so both travel through one `$t`.
 * The server's own words matter here more than anywhere else in the admin: a
 * lesson refused at save time is somebody's afternoon.
 */
export const reasonOf = (error: unknown, fallback: string): string => {
  if (error instanceof OfflineError) return 'error-offline'
  if (error instanceof HttpError && error.status === 403) return 'error-forbidden'
  if (error instanceof HttpError && error.reason) return error.reason
  return fallback
}
