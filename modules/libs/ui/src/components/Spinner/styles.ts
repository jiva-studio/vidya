import { cva } from 'class-variance-authority'

export const spinnerVariants = cva('animate-spin shrink-0 text-[var(--color-text-muted)]', {
  variants: {
    size: {
      sm: 'size-[var(--space-3)]',
      md: 'size-[var(--space-4)]',
      lg: 'size-[var(--space-5)]',
    },
  },
  defaultVariants: { size: 'md' },
})
