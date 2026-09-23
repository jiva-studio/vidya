export const headerClasses = 'flex items-center gap-[var(--space-2)] pb-[var(--space-5)]'

export const titleClasses = [
  'text-[length:var(--text-lg)]',
  'font-[var(--weight-semibold)]',
  'text-[var(--color-text)]',
]

export const backButtonClasses = [
  '-ml-2 flex h-8 w-8 items-center justify-center rounded-full',
  'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]',
  'transition-colors duration-[var(--duration-fast)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
]

export const formClasses = ['flex w-full flex-col gap-[var(--space-4)]']

export const resendRowClasses = ['flex items-center justify-center']

export const linkButtonClasses = [
  'text-[length:var(--text-sm)]',
  'text-[var(--color-text-muted)]',
  'underline-offset-2',
  'hover:underline',
  'disabled:no-underline',
  'disabled:opacity-60',
]
