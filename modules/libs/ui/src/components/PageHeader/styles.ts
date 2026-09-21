// The header is the row. A wrapper between it and the title costs two levels
// of depth once the slots are forwarded, and buys nothing.
export const headerClasses = ['flex flex-wrap items-start justify-between gap-[var(--space-3)]']

export const headingsClasses = ['flex flex-col gap-[var(--space-1)] min-w-0']

// The back action shares the title's line rather than sitting above it: a row
// that appears only on some pages moves the heading between them.
export const titleRowClasses = ['relative flex items-center min-w-0']

/**
 * The back action hangs in the gutter, outside the content column.
 *
 * Out of flow on purpose: in flow it pushes the title right, so the heading
 * lands in one place on a page that has a way back and another on a page that
 * does not. It is sized to fit the content padding exactly, so it never
 * reaches past the edge of the page.
 */
export const leadingClasses = [
  'absolute start-0 top-1/2 flex items-center',
  '-translate-x-full -translate-y-1/2 pe-[var(--space-1)]',
]

export const titleClasses = [
  'text-[length:var(--text-lg)] font-[var(--weight-semibold)]',
  'leading-[var(--leading-tight)] text-[var(--color-text)]',
]

export const descriptionClasses = [
  'max-w-[var(--content-max)] text-[length:var(--text-sm)]',
  'leading-[var(--leading-normal)] text-[var(--color-text-muted)]',
]

export const actionsClasses = ['flex flex-wrap items-center gap-[var(--space-2)] shrink-0']
