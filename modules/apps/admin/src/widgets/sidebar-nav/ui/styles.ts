export const navClasses = [
  'flex',
  'flex-col',
  'gap-[var(--space-5)]',
  'px-[var(--space-3)]',
  'py-[var(--space-4)]',
]

export const groupLabelClasses = [
  'px-[var(--space-2)]',
  'pb-[var(--space-2)]',
  'text-[length:var(--text-2xs)]',
  'font-[var(--weight-semibold)]',
  'uppercase',
  'tracking-wide',
  'text-[var(--color-text-muted)]',
]

export const itemClasses = [
  'flex',
  'h-[var(--control-md)]',
  'items-center',
  'gap-[var(--space-2)]',
  'rounded-[var(--radius-md)]',
  'px-[var(--space-2)]',
  'text-[length:var(--text-base)]',
  'text-[var(--color-text)]',
  'transition-colors',
  'duration-[var(--duration-fast)]',
  'hover:bg-[var(--color-surface-hover)]',
]

export const activeItemClasses = [
  'bg-[var(--color-surface-hover)]',
  'font-[var(--weight-medium)]',
  'text-[var(--color-primary)]',
]

/**
 * The page that is open, shown under the entry it belongs to.
 *
 * Indented one step and hung off a rule, which is what carries the relation:
 * without it a nested entry reads as another entry of the section above.
 */
export const subListClasses = [
  'm-0',
  'mt-[var(--space-1)]',
  'ms-[var(--space-4)]',
  'list-none',
  'border-s',
  'border-[var(--color-border)]',
  'ps-[var(--space-2)]',
]

export const childClasses = [
  'flex',
  'h-[var(--control-md)]',
  'items-center',
  'rounded-[var(--radius-md)]',
  'px-[var(--space-2)]',
  'text-[length:var(--text-sm)]',
  'font-[var(--weight-medium)]',
  'text-[var(--color-primary)]',
]
