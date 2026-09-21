import { normaliseSchoolCode } from '@vidya/domain'

import { HttpError } from '@/shared/api'
import { config } from '@/shared/config'

/** The console is served on this subdomain of the site it administers. */
const CONSOLE_SUBDOMAIN = 'admin.'

/**
 * The address a joiner opens, which is on the student site and not this one.
 *
 * The site is derived from the console's own address so that a link handed out
 * from a deployment points at that deployment rather than at whatever the build
 * was configured with — `admin.school.ru` hands out `school.ru`, on the same
 * scheme and port. The configured site answers for a console the naming does
 * not fit, a development one among them. The code is normalised because a link
 * is read off a screen and typed back in by hand.
 */
export const buildJoiningLink = (code: string, consoleOrigin: string = originOfPage()): string => {
  const site = siteBehind(consoleOrigin) ?? config.studentBaseUrl

  return `${site.replace(/\/+$/, '')}/j/${normaliseSchoolCode(code)}`
}

// Where the browser has this console open. A default rather than a read inside,
// so a caller can say which console it means and a test does not need a global.
const originOfPage = (): string => globalThis.location?.origin ?? ''

/** The site this console administers, or nothing when its address does not name one. */
const siteBehind = (consoleOrigin: string): string | null => {
  const url = parseOrigin(consoleOrigin)

  if (!url?.hostname.startsWith(CONSOLE_SUBDOMAIN)) return null

  const host = url.hostname.slice(CONSOLE_SUBDOMAIN.length)

  return `${url.protocol}//${host}${url.port ? `:${url.port}` : ''}`
}

const parseOrigin = (origin: string): URL | null => {
  try {
    return new URL(origin)
  } catch {
    // An address that is not one names no site; the configured one answers.
    return null
  }
}

/**
 * Whether a refusal means the school has nothing to give a joiner.
 *
 * The server creates no code for a school whose settings name no role for a new
 * student, because a link to one would meet its first visitor with a failure.
 * That is a setting nobody has filled in, not a fault, and the screen says so.
 */
export const hasNoStudentRole = (error: unknown): boolean =>
  error instanceof HttpError && error.status === 409
