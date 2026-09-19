import { cva } from 'class-variance-authority'

export const cardVariants = cva(
  [
    'flex flex-col gap-[var(--space-4)]',
    'bg-[var(--color-surface)] border border-[var(--color-border)]',
    'rounded-[var(--radius-lg)]',
  ],
  {
    variants: { padded: { true: 'p-[var(--space-5)]', false: '' } },
    defaultVariants: { padded: true },
  },
)

export const headerClasses = ['flex flex-col gap-[var(--space-1)]']

export const titleClasses = [
  'text-[length:var(--text-md)] font-[var(--weight-semibold)]',
  'leading-[var(--leading-tight)] text-[var(--color-text)]',
]

export const descriptionClasses = [
  'text-[length:var(--text-sm)] leading-[var(--leading-normal)]',
  'text-[var(--color-text-muted)]',
]

export const footerClasses = [
  'flex flex-wrap items-center justify-end gap-[var(--space-2)]',
  'pt-[var(--space-3)] border-t border-[var(--color-border)]',
]
