import { cva } from 'class-variance-authority'

export const separatorVariants = cva('bg-[var(--color-border)] shrink-0', {
  variants: {
    orientation: { horizontal: 'h-px w-full', vertical: 'w-px self-stretch' },
  },
  defaultVariants: { orientation: 'horizontal' },
})

export const labelledClasses = ['flex items-center gap-[var(--space-3)] w-full']

export const labelClasses = [
  'text-[length:var(--text-2xs)] uppercase tracking-wide whitespace-nowrap',
  'font-[var(--weight-medium)] text-[var(--color-text-muted)]',
]
