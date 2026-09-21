export const pageClasses = ['flex', 'flex-col', 'gap-[var(--space-5)]']

export const headerClasses = ['pb-[var(--space-5)]']

export const titleClasses = [
  'text-[length:var(--text-lg)]',
  'font-[var(--weight-semibold)]',
  'text-[var(--color-text)]',
]

// `auto-fill` rather than a fixed count: the page holds one to five of these
// depending on the role, and a fixed grid leaves holes.
export const gridClasses = [
  'grid gap-[var(--space-4)]',
  'grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]',
]

// The whole card is the control, not a link at the bottom of one.
export const cardClasses = [
  'flex flex-col justify-between gap-[var(--space-4)] text-start',
  'rounded-[var(--radius-lg)] border border-[var(--color-border)]',
  'bg-[var(--color-surface)] p-[var(--space-5)]',
  'cursor-pointer transition-colors duration-[var(--duration-fast)] ease-[var(--ease)]',
  'hover:border-[var(--color-primary-border)] hover:bg-[var(--color-primary-surface)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
]

export const islandBodyClasses = ['flex', 'flex-col', 'gap-[var(--space-2)]']

export const islandTitleClasses = [
  'text-[length:var(--text-md)]',
  'font-[var(--weight-semibold)]',
  'text-[var(--color-text)]',
]

export const countClasses = [
  'text-[length:var(--text-xl)]',
  'font-[var(--weight-semibold)]',
  'text-[var(--color-text)]',
  'leading-[var(--leading-tight)]',
]

// An empty queue is good news, not a headline.
export const countQuietClasses = [
  'text-[length:var(--text-xl)]',
  'font-[var(--weight-semibold)]',
  'text-[var(--color-text-muted)]',
  'leading-[var(--leading-tight)]',
]

export const noteClasses = ['text-[length:var(--text-sm)]', 'text-[var(--color-text-muted)]']

export const actionClasses = [
  'inline-flex items-center gap-[var(--space-1)]',
  'text-[length:var(--text-sm)]',
  'font-[var(--weight-medium)]',
  'text-[var(--color-primary)]',
]

export const islandIconClasses = ['size-[var(--space-4)]']
