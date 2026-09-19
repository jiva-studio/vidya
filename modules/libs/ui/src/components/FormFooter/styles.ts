import { cva } from 'class-variance-authority'

export const footerVariants = cva(
  [
    'flex flex-wrap items-center gap-[var(--space-2)]',
    'pt-[var(--space-4)] border-t border-[var(--color-border)]',
  ],
  {
    variants: {
      align: { start: 'justify-start', end: 'justify-end', between: 'justify-between' },
    },
    defaultVariants: { align: 'end' },
  },
)

export const errorClasses = [
  'mr-auto text-[length:var(--text-xs)] font-[var(--weight-medium)]',
  'text-[var(--color-danger-fg)]',
]
