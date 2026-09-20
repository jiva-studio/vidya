/**
 * Normalises a login (email or, eventually, phone) to a single canonical
 * form: trimmed, lower-cased. Applied at the DTO boundary via `@Transform`
 * so the Redis OTP key, the attempt counter and the user lookup all see the
 * same string regardless of how the caller capitalised or padded it.
 *
 * Non-string input is returned unchanged so `@IsEmail`/`@IsNotEmpty` can
 * report the real validation error instead of this silently coercing it.
 */
export const normalizeLogin = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value
