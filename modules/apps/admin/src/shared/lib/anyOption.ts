/**
 * The "no narrowing" row of a filter select.
 *
 * A placeholder cannot be chosen, so the row needs a value, and it cannot be
 * the empty string: the select refuses one. Never a valid identifier.
 */
export const ANY = '*'

/** What the select shows for a filter that may be unset. */
export const asSelected = (value: string | undefined): string => value ?? ANY

/** What the filter holds for what the select gave back. */
export const asFilter = <T extends string>(value: string): T | undefined =>
  value === ANY || value === '' ? undefined : (value as T)
