import { HttpError, OfflineError } from '@/shared/api'

/**
 * A refusal turned into something the screen can print.
 *
 * Either the reason the server gave or a Fluent key the template resolves;
 * Fluent returns an unknown key unchanged, so both travel through one `$t`.
 */
export const reasonOf = (error: unknown, fallback: string): string => {
  if (error instanceof OfflineError) return 'error-offline'
  if (error instanceof HttpError && error.status === 403) return 'error-forbidden'
  if (error instanceof HttpError && error.reason) return error.reason
  return fallback
}
