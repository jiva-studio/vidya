import { cva } from 'class-variance-authority'

export const buttonBase = [
  'relative inline-flex items-center justify-center gap-[var(--space-2)]',
  'whitespace-nowrap select-none',
  'rounded-[var(--radius-md)] border border-transparent',
  'font-[var(--weight-medium)] leading-[var(--leading-tight)]',
  'transition-colors duration-[var(--duration-fast)] ease-[var(--ease)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
  'disabled:pointer-events-none disabled:opacity-50',
]

export const buttonVariants = cva(buttonBase, {
  variants: {
    variant: {
      primary:
        'bg-[var(--color-primary)] text-[var(--color-text-inverse)] hover:bg-[var(--color-primary-hover)]',
      secondary:
        'bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)]',
      ghost: 'bg-transparent text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]',
      danger:
        'bg-[var(--color-danger-fg)] text-[var(--color-text-inverse)] hover:bg-[var(--color-danger-fg-hover)]',
    },
    size: {
      sm: 'h-[var(--control-sm)] px-[var(--space-2)] text-[length:var(--text-xs)]',
      md: 'h-[var(--control-md)] px-[var(--space-3)] text-[length:var(--text-base)]',
      lg: 'h-[var(--control-lg)] px-[var(--space-4)] text-[length:var(--text-base)]',
    },
    fullWidth: { true: 'w-full', false: '' },
  },
  defaultVariants: { variant: 'primary', size: 'md', fullWidth: false },
})

// While busy the label stays in place and keeps the button from resizing;
// only its ink is hidden, and the spinner sits on top of it.
export const busyLabelClasses = ['invisible']
export const busyOverlayClasses = ['absolute inset-0 grid place-items-center']
