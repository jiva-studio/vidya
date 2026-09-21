/** How many tint pairs `--color-avatar-N-*` the tokens define. */
export const AVATAR_TINTS = 6

/**
 * Which tint a name wears, from 1 to {@link AVATAR_TINTS}.
 *
 * A hash and not a counter, so one person keeps one colour everywhere.
 *
 * Both constants are chosen against {@link AVATAR_TINTS} and neither is free:
 * a multiplier sharing a factor with it lets the last character decide the
 * result on its own, and a modulus sharing one preserves that. 31 is coprime
 * to 6 and 2^32 is coprime to 3.
 */
export const avatarTint = (name: string): number => {
  let hash = 0

  for (const character of name.trim()) {
    hash = (hash * 31 + character.codePointAt(0)!) % 0x100000000
  }

  return (hash % AVATAR_TINTS) + 1
}
