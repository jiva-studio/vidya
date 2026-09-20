export const rootClasses = ['flex flex-col gap-[var(--space-1)] w-[var(--search-width)]']

export const filterClasses = [
  'w-full h-[var(--control-md)] px-[var(--space-2)]',
  'bg-[var(--color-surface)] rounded-[var(--radius-sm)]',
  'border border-[var(--color-border-strong)]',
  'text-[length:var(--text-base)] text-[var(--color-text)]',
  'placeholder:text-[var(--color-text-muted)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
]

export const contentClasses = ['max-h-[14rem] overflow-y-auto flex flex-col']

export const emptyClasses = [
  'px-[var(--space-2)] py-[var(--space-2)]',
  'text-[length:var(--text-sm)] text-[var(--color-text-muted)]',
]

export const itemClasses = [
  'flex items-center gap-[var(--space-2)] px-[var(--space-2)] py-[var(--space-1)]',
  'rounded-[var(--radius-sm)] cursor-default select-none text-left',
  'data-[highlighted]:bg-[var(--color-surface-hover)] data-[highlighted]:outline-none',
  'data-[disabled]:opacity-50 data-[disabled]:pointer-events-none',
]

export const itemTextClasses = ['flex flex-col min-w-0']

export const itemLabelClasses = ['text-[length:var(--text-base)] text-[var(--color-text)] truncate']

export const itemDescriptionClasses = [
  'text-[length:var(--text-xs)] text-[var(--color-text-muted)] truncate',
]

export const iconClasses = ['size-[var(--space-4)] text-[var(--color-text-muted)] shrink-0']
