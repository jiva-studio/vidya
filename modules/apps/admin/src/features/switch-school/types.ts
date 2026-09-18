import type { SchoolId } from '@vidya/domain'

/** One entry in the switcher: the id the token granted, and a name if we have one. */
export interface SchoolOption {
  readonly id: SchoolId
  readonly name: string
}
