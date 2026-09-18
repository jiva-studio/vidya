export const rootClasses = ['flex flex-col gap-[var(--space-4)]']

export const listClasses = [
  'flex items-center gap-[var(--space-1)]',
  'border-b border-[var(--color-border)]',
]

export const triggerClasses = [
  'inline-flex items-center h-[var(--control-lg)] px-[var(--space-3)]',
  '-mb-px border-b-2 border-transparent',
  'text-[length:var(--text-base)] text-[var(--color-text-muted)]',
  'transition-colors duration-[var(--duration-fast)] ease-[var(--ease)]',
  'hover:text-[var(--color-text)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
  'data-[state=active]:border-[var(--color-primary)]',
  'data-[state=active]:text-[var(--color-text)]',
  'data-[state=active]:font-[var(--weight-medium)]',
  'data-[disabled]:opacity-50 data-[disabled]:pointer-events-none',
]

export const panelClasses = ['focus:outline-none']
