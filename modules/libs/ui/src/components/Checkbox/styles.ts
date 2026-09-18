export const wrapperClasses = ['flex items-start gap-[var(--space-2)]']

export const boxClasses = [
  'peer shrink-0 grid place-items-center',
  'size-[var(--space-4)] mt-[var(--space-1)]',
  'rounded-[var(--radius-sm)] border border-[var(--color-border-strong)]',
  'bg-[var(--color-surface)] text-[var(--color-text-inverse)]',
  'transition-colors duration-[var(--duration-fast)] ease-[var(--ease)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
  'data-[state=checked]:bg-[var(--color-primary)]',
  'data-[state=checked]:border-[var(--color-primary)]',
  'data-[state=indeterminate]:bg-[var(--color-primary)]',
  'data-[state=indeterminate]:border-[var(--color-primary)]',
  'disabled:opacity-50',
]

export const textClasses = ['flex flex-col gap-[var(--space-1)]']

export const labelClasses = [
  'text-[length:var(--text-base)] leading-[var(--leading-tight)]',
  'text-[var(--color-text)] cursor-pointer',
]

export const descriptionClasses = [
  'text-[length:var(--text-xs)] leading-[var(--leading-normal)]',
  'text-[var(--color-text-muted)]',
]

export const markClasses = ['size-[var(--space-3)]']
