import { cva } from 'class-variance-authority'

export const fieldBase = [
  'w-full min-w-0 bg-[var(--color-surface)] text-[var(--color-text)]',
  'border border-[var(--color-border-strong)] rounded-[var(--radius-md)]',
  'text-[length:var(--text-base)] leading-[var(--leading-normal)]',
  'placeholder:text-[var(--color-text-muted)]',
  'transition-colors duration-[var(--duration-fast)] ease-[var(--ease)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
  'disabled:opacity-50 disabled:bg-[var(--color-surface-sunken)]',
  'read-only:bg-[var(--color-surface-sunken)]',
]

export const inputVariants = cva(fieldBase, {
  variants: {
    size: {
      md: 'h-[var(--control-md)] px-[var(--space-2)]',
      lg: 'h-[var(--control-lg)] px-[var(--space-3)]',
    },
    invalid: { true: 'border-[var(--color-danger-border)]', false: '' },
  },
  defaultVariants: { size: 'lg', invalid: false },
})
