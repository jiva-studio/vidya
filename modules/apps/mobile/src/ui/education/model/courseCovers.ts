/**
 * The tones a course cover is drawn in while the course has no picture of its
 * own. Each names a colour the theme already defines, so a cover stays inside
 * the palette and follows it into the dark theme.
 */
export const COVER_TONES = ['primary', 'secondary', 'tertiary', 'success', 'warning'] as const

export type CoverTone = (typeof COVER_TONES)[number]

/**
 * Pick the tone a course is drawn in. The same text always answers the same
 * tone: a catalogue that re-picked on every render would flicker, and a course
 * would not keep the face the student learned to recognise.
 */
export function coverToneOf(seed: string): CoverTone {
  return COVER_TONES[hashOf(seed) % COVER_TONES.length]
}

/**
 * The palette colour a tone stands for, as a triple the cover's gradients and
 * tints can weigh with an alpha. It resolves in the theme, so a cover follows
 * the palette into the dark theme without being redrawn.
 */
export function coverToneRgb(tone: CoverTone): string {
  return `var(--ion-color-${tone}-rgb)`
}

/** The letter a cover carries when there is no picture behind it. */
export function coverInitialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase()
}

// FNV-1a over the code units. Spread matters more than strength here: the
// tones sit next to each other in a list, and neighbours must not collide.
function hashOf(seed: string): number {
  let hash = 0x811c9dc5

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }

  return hash
}
