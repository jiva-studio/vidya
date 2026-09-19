import { cva } from 'class-variance-authority'

export const rootClasses = ['flex flex-col gap-[var(--space-4)]']

export const listVariants = cva([], {
  variants: {
    variant: {
      line: 'flex items-center gap-[var(--space-1)] border-b border-[var(--color-border)]',
      segmented:
        'inline-flex items-center gap-[var(--space-1)] p-[var(--space-1)] bg-[var(--color-surface-sunken)] rounded-[var(--radius-md)] border border-[var(--color-border)] self-start',
    },
  },
  defaultVariants: { variant: 'line' },
})

export const triggerVariants = cva(
  [
    'inline-flex items-center justify-center select-none',
    'transition-colors duration-[var(--duration-fast)] ease-[var(--ease)]',
    'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
    'data-[disabled]:opacity-50 data-[disabled]:pointer-events-none',
  ],
  {
    variants: {
      variant: {
        line: [
          'h-[var(--control-lg)] px-[var(--space-3)]',
          '-mb-px border-b-2 border-transparent',
          'text-[length:var(--text-base)] text-[var(--color-text-muted)]',
          'hover:text-[var(--color-text)]',
          'data-[state=active]:border-[var(--color-primary)]',
          'data-[state=active]:text-[var(--color-text)]',
          'data-[state=active]:font-[var(--weight-medium)]',
        ],
        segmented: [
          'h-[calc(var(--control-md)-var(--space-1))] px-[var(--space-3)]',
          'rounded-[var(--radius-sm)]',
          'text-[length:var(--text-sm)] text-[var(--color-text-muted)]',
          'hover:text-[var(--color-text)]',
          'data-[state=active]:bg-[var(--color-surface)]',
          'data-[state=active]:text-[var(--color-text)]',
          'data-[state=active]:font-[var(--weight-medium)]',
          'data-[state=active]:shadow-[var(--shadow-sm)]',
        ],
      },
    },
    defaultVariants: { variant: 'line' },
  },
)

export const panelClasses = ['focus:outline-none']

