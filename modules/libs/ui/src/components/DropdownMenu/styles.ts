export const triggerClasses = [
  'inline-grid place-items-center size-[var(--control-sm)]',
  'rounded-[var(--radius-md)] text-[var(--color-text-muted)]',
  'transition-colors duration-[var(--duration-fast)] ease-[var(--ease)]',
  'hover:bg-[var(--color-surface-hover)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
]

export const contentClasses = [
  'z-[var(--z-dialog)] min-w-[var(--menu-min-width)]',
  'bg-[var(--color-surface)] border border-[var(--color-border)]',
  'rounded-[var(--radius-md)] shadow-[var(--shadow-md)] p-[var(--space-1)]',
]

export const itemClasses = [
  'flex items-center h-[var(--control-md)] px-[var(--space-2)]',
  'rounded-[var(--radius-sm)] cursor-default select-none',
  'text-[length:var(--text-base)] text-[var(--color-text)]',
  'data-[highlighted]:bg-[var(--color-surface-hover)] data-[highlighted]:outline-none',
  'data-[disabled]:opacity-50 data-[disabled]:pointer-events-none',
]

export const destructiveItemClasses = ['text-[var(--color-danger-fg)]']

export const separatorClasses = ['my-[var(--space-1)] h-px bg-[var(--color-border)]']

export const iconClasses = ['size-[var(--space-4)]']
