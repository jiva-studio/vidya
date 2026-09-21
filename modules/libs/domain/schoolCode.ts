/**
 * The public code a joining link carries: `https://<host>/j/AB3K7Q`.
 *
 * Six characters of Crockford's base32 — the digits and the letters, minus
 * `I`, `L`, `O` and `U`. The first three are dropped because a person copying
 * a code off a poster confuses them with `1` and `0`; the fourth because an
 * alphabet that can spell an obscenity eventually does.
 *
 * Matching is case-insensitive and normalises to upper case, so a link typed
 * in lower case resolves to the same school.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export const SCHOOL_CODE_LENGTH = 6

export const schoolCodeAlphabet = (): string => ALPHABET

export const normaliseSchoolCode = (value: string): string => value.trim().toUpperCase()

export const isSchoolCode = (value: string): boolean => {
  const code = normaliseSchoolCode(value)
  if (code.length !== SCHOOL_CODE_LENGTH) return false

  return [...code].every((character) => ALPHABET.includes(character))
}
