export const rootClasses = [
  'flex flex-wrap items-center justify-between gap-[var(--space-3)]',
  'pt-[var(--space-3)]',
]

export const summaryClasses = [
  'text-[length:var(--text-xs)] text-[var(--color-text-muted)] tabular-nums',
]

export const listClasses = ['flex items-center gap-[var(--space-1)]']

export const stepClasses = [
  'inline-grid place-items-center size-[var(--control-md)]',
  'rounded-[var(--radius-md)] border border-[var(--color-border-strong)]',
  'bg-[var(--color-surface)] text-[var(--color-text)]',
  'transition-colors duration-[var(--duration-fast)] ease-[var(--ease)]',
  'hover:bg-[var(--color-surface-hover)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
  'disabled:opacity-50 disabled:pointer-events-none',
]

export const pageClasses = [
  'inline-grid place-items-center size-[var(--control-md)]',
  'rounded-[var(--radius-md)] border border-transparent tabular-nums',
  'text-[length:var(--text-base)] text-[var(--color-text)]',
  'transition-colors duration-[var(--duration-fast)] ease-[var(--ease)]',
  'hover:bg-[var(--color-surface-hover)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
  'data-[selected]:bg-[var(--color-primary)] data-[selected]:text-[var(--color-text-inverse)]',
]

export const ellipsisClasses = [
  'inline-grid place-items-center size-[var(--control-md)]',
  'text-[var(--color-text-muted)]',
]

export const iconClasses = ['size-[var(--space-4)]']
