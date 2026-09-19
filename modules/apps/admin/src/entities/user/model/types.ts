import type { UserSummary } from '@vidya/protocol'

/**
 * One line of the users table.
 *
 * `UserSummary` is an identifier and a name — no address, no avatar, no title
 * and no status. The admin this replaces showed all four; none of them exist
 * in our schema, so none of them are shown.
 */
export type UserRow = UserSummary

/** What the user form edits. */
export interface UserFormValues {
  name: string
  email: string
  phone: string
}
