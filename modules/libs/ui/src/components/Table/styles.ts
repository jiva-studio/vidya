import { cva } from 'class-variance-authority'

export const frameClasses = [
  'w-full overflow-x-auto bg-[var(--color-surface)]',
  'border border-[var(--color-border)] rounded-[var(--radius-lg)]',
]

export const tableClasses = [
  'w-full border-collapse tabular-nums',
  'text-[length:var(--text-base)]',
]

export const captionClasses = ['sr-only']

export const headRowClasses = [
  'border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]',
]

/**
 * A table has three type treatments and may invent no fourth: the header, the
 * cell that names the row, and every other cell. Two weights, two colours.
 */
export const headCellVariants = cva(
  [
    'px-[var(--space-4)] h-[var(--row-height)]',
    'text-[length:var(--text-xs)] font-[var(--weight-medium)]',
    'uppercase tracking-wide text-[var(--color-text-muted)]',
    'whitespace-nowrap',
  ],
  {
    variants: { align: { start: 'text-left', end: 'text-right' } },
    defaultVariants: { align: 'start' },
  },
)

export const rowVariants = cva(
  [
    'border-b border-[var(--color-border)] last:border-b-0',
    'transition-colors duration-[var(--duration-fast)] ease-[var(--ease)]',
  ],
  {
    variants: {
      interactive: {
        true: 'cursor-pointer hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
        false: '',
      },
      selected: { true: 'bg-[var(--color-primary-surface)]', false: '' },
    },
    defaultVariants: { interactive: false, selected: false },
  },
)

// The height is a floor, not a ceiling: a cell of two lines grows its row.
export const cellVariants = cva(
  [
    'px-[var(--space-4)] py-[var(--space-2)] h-[var(--row-height)]',
    'align-middle leading-[var(--leading-normal)]',
  ],
  {
    variants: {
      align: { start: 'text-left', end: 'text-right' },
      tone: {
        primary: 'font-[var(--weight-medium)] text-[var(--color-text)]',
        secondary: 'font-[var(--weight-normal)] text-[var(--color-text-muted)]',
      },
      nowrap: { true: 'whitespace-nowrap', false: '' },
    },
    defaultVariants: { align: 'start', tone: 'secondary', nowrap: false },
  },
)

// A table cell ignores a max-width of its own, so the long text carries it.
export const truncateClasses = ['block max-w-[var(--col-text)] truncate']

export const actionsClasses = ['flex items-center justify-end gap-[var(--space-1)]']

export const loadingClasses = [
  'flex flex-col gap-[var(--space-3)] p-[var(--space-4)]',
  'bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)]',
]
