import { cva } from 'class-variance-authority'

import { AVATAR_TINTS } from './tint'

export const avatarVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center overflow-hidden',
    'rounded-[var(--radius-full)] select-none',
    'font-[var(--weight-medium)] uppercase',
  ],
  {
    variants: {
      size: {
        sm: 'size-[var(--control-sm)] text-[length:var(--text-2xs)]',
        md: 'size-[var(--control-md)] text-[length:var(--text-xs)]',
        lg: 'size-[var(--control-lg)] text-[length:var(--text-sm)]',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

/**
 * The tint pairs, spelled out one class at a time.
 *
 * Tailwind scans source text, so a class assembled from a number at runtime is
 * a class it never emits. The index into this array is what varies; the strings
 * themselves are literals it can find.
 */
export const tintClasses = [
  'bg-[var(--color-avatar-1-surface)] text-[var(--color-avatar-1-fg)]',
  'bg-[var(--color-avatar-2-surface)] text-[var(--color-avatar-2-fg)]',
  'bg-[var(--color-avatar-3-surface)] text-[var(--color-avatar-3-fg)]',
  'bg-[var(--color-avatar-4-surface)] text-[var(--color-avatar-4-fg)]',
  'bg-[var(--color-avatar-5-surface)] text-[var(--color-avatar-5-fg)]',
  'bg-[var(--color-avatar-6-surface)] text-[var(--color-avatar-6-fg)]',
] as const

if (tintClasses.length !== AVATAR_TINTS) {
  throw new Error('Avatar tint classes and AVATAR_TINTS have drifted apart')
}

/** Nobody to tell apart from anybody: a name that is not there gets no colour. */
export const unnamedClasses = 'bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]'

export const imageClasses = ['size-full object-cover']
