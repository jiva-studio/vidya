export const wrapperClasses = ['flex items-center justify-between gap-[var(--space-4)]']

export const trackClasses = [
  'shrink-0 inline-flex items-center',
  'w-[var(--space-6)] h-[var(--space-4)] p-[var(--border-width)]',
  'rounded-[var(--radius-full)] border border-[var(--color-border-strong)]',
  'bg-[var(--color-neutral-300)]',
  'transition-colors duration-[var(--duration-fast)] ease-[var(--ease)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
  'data-[state=checked]:bg-[var(--color-primary)]',
  'data-[state=checked]:border-[var(--color-primary)]',
  'disabled:opacity-50',
]

export const thumbClasses = [
  'block size-[var(--space-3)] rounded-[var(--radius-full)]',
  'bg-[var(--color-surface)] shadow-[var(--shadow-sm)]',
  'transition-transform duration-[var(--duration-fast)] ease-[var(--ease)]',
  'data-[state=checked]:translate-x-[var(--space-2)]',
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
