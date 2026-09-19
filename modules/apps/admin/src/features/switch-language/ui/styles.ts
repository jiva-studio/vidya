export const switchClasses = ['flex', 'items-center', 'gap-[var(--space-1)]']

export const optionClasses = [
  'rounded-[var(--radius-sm)]',
  'px-[var(--space-2)]',
  'py-[var(--space-1)]',
  'text-[length:var(--text-sm)]',
  'text-[var(--color-text-muted)]',
  'transition-colors',
  'duration-100',
  'hover:text-[var(--color-text)]',
]

export const currentClasses = [
  ...optionClasses,
  'bg-[var(--color-surface-sunken)]',
  'font-[var(--weight-medium)]',
  'text-[var(--color-text)]',
]
