import { cva } from 'class-variance-authority'

export const triggerVariants = cva(
  [
    'w-full inline-flex items-center justify-between gap-[var(--space-2)]',
    'h-[var(--control-lg)] px-[var(--space-3)]',
    'bg-[var(--color-surface)] text-[var(--color-text)] text-left',
    'border border-[var(--color-border-strong)] rounded-[var(--radius-md)]',
    'text-[length:var(--text-base)] leading-[var(--leading-normal)]',
    'transition-colors duration-[var(--duration-fast)] ease-[var(--ease)]',
    'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
    'disabled:opacity-50 disabled:bg-[var(--color-surface-sunken)]',
    'data-[placeholder]:text-[var(--color-text-muted)]',
  ],
  {
    variants: { invalid: { true: 'border-[var(--color-danger-border)]', false: '' } },
    defaultVariants: { invalid: false },
  },
)

// The surface every menu-like overlay shares: select, combobox, dropdown.
export const surfaceClasses = [
  'z-[var(--z-dialog)] min-w-[var(--menu-min-width)] overflow-hidden',
  'bg-[var(--color-surface)] text-[var(--color-text)]',
  'border border-[var(--color-border)] rounded-[var(--radius-md)]',
  'shadow-[var(--shadow-md)] p-[var(--space-1)]',
]

export const optionClasses = [
  'relative flex items-center justify-between gap-[var(--space-2)]',
  'h-[var(--control-md)] px-[var(--space-2)] cursor-default select-none',
  'rounded-[var(--radius-sm)] text-[length:var(--text-base)]',
  'data-[highlighted]:bg-[var(--color-surface-hover)] data-[highlighted]:outline-none',
  'data-[disabled]:opacity-50 data-[disabled]:pointer-events-none',
]

export const iconClasses = ['size-[var(--space-4)] text-[var(--color-text-muted)] shrink-0']
export const markClasses = ['size-[var(--space-3)] text-[var(--color-primary)] shrink-0']
