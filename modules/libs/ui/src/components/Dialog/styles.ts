import { cva } from 'class-variance-authority'

export const overlayClasses = ['fixed inset-0 z-[var(--z-dialog)] bg-[var(--color-neutral-900)]/40']

export const contentVariants = cva(
  [
    'fixed left-1/2 top-1/2 z-[var(--z-dialog)] -translate-x-1/2 -translate-y-1/2',
    'w-[calc(100%-var(--space-6))] max-h-[calc(100%-var(--space-6))] overflow-y-auto',
    'flex flex-col gap-[var(--space-4)]',
    'bg-[var(--color-surface)] border border-[var(--color-border)]',
    'rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] p-[var(--space-5)]',
    'focus:outline-none',
  ],
  {
    variants: {
      size: { md: 'max-w-[var(--sidebar-width)]', lg: 'max-w-[var(--content-max)]' },
    },
    defaultVariants: { size: 'md' },
  },
)

export const headerClasses = ['flex items-start justify-between gap-[var(--space-4)]']

export const headingsClasses = ['flex flex-col gap-[var(--space-1)]']

export const titleClasses = [
  'text-[length:var(--text-md)] font-[var(--weight-semibold)]',
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

export const footerClasses = ['flex flex-wrap items-center justify-end gap-[var(--space-2)]']
