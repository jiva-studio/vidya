/** How many tint pairs `--color-avatar-N-*` the tokens define. */
export const AVATAR_TINTS = 6

/**
 * Which tint a name wears, from 1 to {@link AVATAR_TINTS}.
 *
 * A hash and not a counter: the same person keeps the same colour in a list, in
 * a header and in a dialog, and two renders of one table never disagree. The
 * multiplier is the usual djb2 constant; any odd number would do, the point is
 * only that two names one letter apart land far apart.
 */
export const avatarTint = (name: string): number => {
  let hash = 0

  for (const character of name.trim()) {
    hash = (hash * 33 + character.codePointAt(0)!) % 0xffffffff
  }

  return (hash % AVATAR_TINTS) + 1
}
