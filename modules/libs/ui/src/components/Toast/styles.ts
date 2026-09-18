import { cva } from 'class-variance-authority'

export const toastVariants = cva(
  [
    'flex items-start gap-[var(--space-3)]',
    'p-[var(--space-3)] rounded-[var(--radius-md)] border',
    'bg-[var(--color-surface)] shadow-[var(--shadow-md)]',
  ],
  {
    variants: {
      tone: {
        neutral: 'border-[var(--color-border)]',
        success: 'border-[var(--color-success-border)]',
        danger: 'border-[var(--color-danger-border)]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export const textClasses = ['flex flex-col gap-[var(--space-1)] flex-1 min-w-0']

export const titleClasses = [
  'text-[length:var(--text-base)] font-[var(--weight-medium)]',
  'leading-[var(--leading-tight)] text-[var(--color-text)]',
]

export const descriptionClasses = [
  'text-[length:var(--text-sm)] leading-[var(--leading-normal)]',
  'text-[var(--color-text-muted)]',
]

export const closeClasses = [
  'shrink-0 grid place-items-center size-[var(--control-sm)]',
  'rounded-[var(--radius-md)] text-[var(--color-text-muted)]',
  'transition-colors duration-[var(--duration-fast)] ease-[var(--ease)]',
  'hover:bg-[var(--color-surface-hover)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
]

export const iconClasses = ['size-[var(--space-4)]']

export const viewportClasses = [
  'fixed bottom-[var(--space-4)] right-[var(--space-4)] z-[var(--z-toast)]',
  'flex flex-col gap-[var(--space-2)] w-[var(--sidebar-width)] m-0 p-0 list-none outline-none',
]
