import { cva } from 'class-variance-authority'

export const badgeVariants = cva(
  [
    'inline-flex items-center gap-[var(--space-1)]',
    'px-[var(--space-2)] py-[var(--space-1)]',
    'rounded-[var(--radius-full)] border',
    'text-[length:var(--text-xs)] font-[var(--weight-medium)]',
    'leading-[var(--leading-tight)] whitespace-nowrap',
  ],
  {
    variants: {
      tone: {
        neutral:
          'bg-[var(--color-surface-sunken)] border-[var(--color-border)] text-[var(--color-text-muted)]',
        accent:
          'bg-[var(--color-primary-surface)] border-[var(--color-primary-border)] text-[var(--color-primary)]',
        success:
          'bg-[var(--color-success-surface)] border-[var(--color-success-border)] text-[var(--color-success-fg)]',
        warning:
          'bg-[var(--color-warning-surface)] border-[var(--color-warning-border)] text-[var(--color-warning-fg)]',
        danger:
          'bg-[var(--color-danger-surface)] border-[var(--color-danger-border)] text-[var(--color-danger-fg)]',
        info: 'bg-[var(--color-info-surface)] border-[var(--color-info-border)] text-[var(--color-info-fg)]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)
