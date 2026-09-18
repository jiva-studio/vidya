import { cva } from 'class-variance-authority'

export const anchorVariants = cva(
  [
    'w-full flex items-center gap-[var(--space-2)]',
    'h-[var(--control-lg)] px-[var(--space-3)]',
    'bg-[var(--color-surface)] rounded-[var(--radius-md)]',
    'border border-[var(--color-border-strong)]',
    'transition-colors duration-[var(--duration-fast)] ease-[var(--ease)]',
    'focus-within:shadow-[var(--focus-ring)]',
  ],
  {
    variants: { invalid: { true: 'border-[var(--color-danger-border)]', false: '' } },
    defaultVariants: { invalid: false },
  },
)

export const inputClasses = [
  'w-full min-w-0 bg-transparent outline-none',
  'text-[length:var(--text-base)] leading-[var(--leading-normal)]',
  'text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]',
  'disabled:opacity-50',
]

export const contentClasses = [
  'w-full mt-[var(--space-1)] max-h-[var(--space-8)] overflow-y-auto',
  'bg-[var(--color-surface)] border border-[var(--color-border)]',
  'rounded-[var(--radius-md)] shadow-[var(--shadow-md)] p-[var(--space-1)]',
]

export const optionClasses = [
  'flex items-center justify-between gap-[var(--space-2)]',
  'h-[var(--control-md)] px-[var(--space-2)] cursor-default select-none',
  'rounded-[var(--radius-sm)] text-[length:var(--text-base)]',
  'data-[highlighted]:bg-[var(--color-surface-hover)] data-[highlighted]:outline-none',
  'data-[disabled]:opacity-50 data-[disabled]:pointer-events-none',
]

export const emptyClasses = [
  'px-[var(--space-2)] py-[var(--space-2)]',
  'text-[length:var(--text-sm)] text-[var(--color-text-muted)]',
]

export const iconClasses = ['size-[var(--space-4)] text-[var(--color-text-muted)] shrink-0']
export const markClasses = ['size-[var(--space-3)] text-[var(--color-primary)] shrink-0']
