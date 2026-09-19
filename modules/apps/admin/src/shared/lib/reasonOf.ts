import { HttpError, OfflineError } from '@/shared/api'

/**
 * A refusal turned into something the screen can print.
 *
 * A 4xx sentence describes what the operator did — "A school with this name
 * already exists" tells them what to change — so it is shown as the server
 * wrote it. Anything else describes our machinery: "Mailer is down" names a
 * service the operator has never heard of and offers them nothing to do about
 * it, so those become our own words. Fluent returns an unknown key unchanged,
 * so a sentence and a key both travel through `$t`.
 */
export const reasonOf = (error: unknown, fallback = 'state-error'): string => {
  if (error instanceof OfflineError) return 'error-offline'
  if (!(error instanceof HttpError)) return fallback
  if (error.status === 403) return 'error-forbidden'
  if (error.status >= 500) return 'error-server'
  return error.reason ?? fallback
}
