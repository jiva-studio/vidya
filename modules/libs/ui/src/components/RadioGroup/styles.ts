import { cva } from 'class-variance-authority'

export const groupVariants = cva('flex', {
  variants: {
    orientation: {
      vertical: 'flex-col gap-[var(--space-3)]',
      horizontal: 'flex-row flex-wrap gap-[var(--space-4)]',
    },
  },
  defaultVariants: { orientation: 'vertical' },
})

export const itemWrapperClasses = ['flex items-start gap-[var(--space-2)]']

export const dotWrapperClasses = [
  'shrink-0 grid place-items-center mt-[var(--space-1)]',
  'size-[var(--space-4)] rounded-[var(--radius-full)]',
  'border border-[var(--color-border-strong)] bg-[var(--color-surface)]',
  'transition-colors duration-[var(--duration-fast)] ease-[var(--ease)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
  'data-[state=checked]:border-[var(--color-primary)]',
  'disabled:opacity-50',
]

export const dotClasses = [
  'block size-[var(--space-2)] rounded-[var(--radius-full)]',
  'bg-[var(--color-primary)]',
]

export const textClasses = ['flex flex-col gap-[var(--space-1)]']

export const labelClasses = [
  'text-[length:var(--text-base)] leading-[var(--leading-tight)]',
  'text-[var(--color-text)] cursor-pointer',
]

export const descriptionClasses = [
  'text-[length:var(--text-xs)] leading-[var(--leading-normal)]',
  'text-[var(--color-text-muted)]',
]
