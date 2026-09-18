import { cva } from 'class-variance-authority'

export const frameClasses = [
  'w-full overflow-x-auto bg-[var(--color-surface)]',
  'border border-[var(--color-border)] rounded-[var(--radius-lg)]',
]

export const tableClasses = ['w-full border-collapse text-[length:var(--text-base)]']

export const captionClasses = ['sr-only']

export const headRowClasses = ['border-b border-[var(--color-border)]']

export const headCellVariants = cva(
  [
    'px-[var(--space-4)] h-[var(--control-lg)]',
    'text-[length:var(--text-xs)] font-[var(--weight-semibold)]',
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

export const cellVariants = cva(['px-[var(--space-4)] h-[var(--row-height)] align-middle'], {
  variants: {
    align: { start: 'text-left', end: 'text-right' },
    numeric: { true: 'tabular-nums font-[var(--font-mono)]', false: '' },
    muted: { true: 'text-[var(--color-text-muted)]', false: 'text-[var(--color-text)]' },
    strong: { true: 'font-[var(--weight-medium)]', false: '' },
  },
  defaultVariants: { align: 'start', numeric: false, muted: false, strong: false },
})

export const loadingClasses = [
  'flex flex-col gap-[var(--space-3)] p-[var(--space-4)]',
  'bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)]',
]
