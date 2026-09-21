/**
 * The "no narrowing" row of a filter select.
 *
 * A placeholder alone cannot be chosen, so a select that starts narrowed has no
 * way back to the whole list. The row needs a value of its own, and it cannot
 * be the empty string: the select refuses one. This sentinel is never an
 * identifier, so it cannot collide with a course or a group.
 */
export const ANY = '*'

/** What the select shows for a filter that may be unset. */
export const asSelected = (value: string | undefined): string => value ?? ANY

/** What the filter holds for what the select gave back. */
export const asFilter = <T extends string>(value: string): T | undefined =>
  value === ANY || value === '' ? undefined : (value as T)
