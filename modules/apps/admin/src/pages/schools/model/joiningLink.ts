import { normaliseSchoolCode } from '@vidya/domain'

import { HttpError } from '@/shared/api'
import { config } from '@/shared/config'

/**
 * The address a joiner opens, which is on the student site and not this one.
 *
 * The two are separate origins, so the console cannot derive the link from its
 * own address; it is told where the student site stands and puts the code on
 * the end. The code is normalised because a link is read off a screen and
 * typed back in by hand.
 */
export const buildJoiningLink = (code: string): string =>
  `${config.studentBaseUrl.replace(/\/+$/, '')}/j/${normaliseSchoolCode(code)}`

/**
 * Whether a refusal means the school has nothing to give a joiner.
 *
 * The server creates no code for a school whose settings name no role for a new
 * student, because a link to one would meet its first visitor with a failure.
 * That is a setting nobody has filled in, not a fault, and the screen says so.
 */
export const hasNoStudentRole = (error: unknown): boolean =>
  error instanceof HttpError && error.status === 409
