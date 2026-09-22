import type { LocalSchool } from '@vidya/client'

/**
 * One school of the student's, with what leaving it would cost.
 *
 * `places` counts the live places this machine holds in that school. It is the
 * number the screen says before asking, because the server's own count comes
 * back with the answer — after the places are already gone.
 */
export interface SchoolRow {
  readonly school: LocalSchool
  readonly places: number
}
