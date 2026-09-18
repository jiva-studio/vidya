export const overlayClasses = ['fixed inset-0 z-[var(--z-dialog)] bg-[var(--color-neutral-900)]/40']

export const contentClasses = [
  'fixed left-1/2 top-1/2 z-[var(--z-dialog)] -translate-x-1/2 -translate-y-1/2',
  'w-[calc(100%-var(--space-6))] max-w-[var(--sidebar-width)]',
  'flex flex-col gap-[var(--space-3)]',
  'bg-[var(--color-surface)] border border-[var(--color-border)]',
  'rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] p-[var(--space-5)]',
  'focus:outline-none',
]

export const titleClasses = [
  'text-[length:var(--text-md)] font-[var(--weight-semibold)]',
  'leading-[var(--leading-tight)] text-[var(--color-text)]',
]

export const descriptionClasses = [
  'text-[length:var(--text-sm)] leading-[var(--leading-normal)]',
  'text-[var(--color-text)]',
]

export const actionsClasses = [
  'flex flex-wrap items-center justify-end gap-[var(--space-2)] pt-[var(--space-2)]',
]
