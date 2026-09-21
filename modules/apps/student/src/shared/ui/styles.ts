/**
 * The classes every screen of the skeleton shares.
 *
 * One vocabulary rather than a copy per page: the screens have no content yet,
 * and a heading that drifts between seven files is seven places to fix when
 * the first real design arrives.
 */
export const pageClasses = ['mx-auto flex w-full max-w-3xl flex-col gap-[var(--space-4)]']

export const titleClasses = ['text-[length:var(--text-xl)] font-semibold']

export const mutedClasses = ['text-[var(--color-text-muted)]']

export const brandClasses = [
  'px-[var(--space-4)] py-[var(--space-4)]',
  'text-[length:var(--text-lg)] font-semibold',
]

export const navClasses = ['flex flex-col gap-[var(--space-1)] px-[var(--space-2)]']

/** The same sections on a screen too narrow for the sidebar to be drawn. */
export const compactNavClasses = [
  'md:hidden flex flex-wrap items-center gap-[var(--space-2)]',
  'border-b border-[var(--color-border)] pb-[var(--space-3)]',
]

export const navLinkClasses = [
  'flex items-center gap-[var(--space-2)]',
  'rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)]',
  'text-[length:var(--text-sm)] no-underline text-[var(--color-text-muted)]',
  'hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
  'aria-[current=page]:bg-[var(--color-primary-surface)]',
  'aria-[current=page]:text-[var(--color-primary)]',
]

/** A screen shown outside the shell, such as signing in or joining a school. */
export const loneClasses = ['flex-1 p-[var(--space-4)]']

export const sectionClasses = ['flex flex-col gap-[var(--space-2)]']

export const backfillClasses = [
  'flex flex-col items-start gap-[var(--space-2)]',
  'rounded-[var(--radius-md)] border border-[var(--color-border)] p-[var(--space-4)]',
]

export const submissionClasses = ['flex flex-col items-start gap-[var(--space-1)]']

export const answerClasses = [
  'flex flex-col gap-[var(--space-2)]',
  'rounded-[var(--radius-md)] border border-[var(--color-border)] p-[var(--space-3)]',
]

export const answerRowClasses = ['flex flex-wrap items-center gap-[var(--space-2)]']

export const commentClasses = [
  'border-s-2 border-[var(--color-border)] ps-[var(--space-3)]',
  'text-[var(--color-text-muted)]',
]

export const actionLinkClasses = [
  'inline-flex items-center rounded-[var(--radius-md)]',
  'bg-[var(--color-primary)] px-[var(--space-4)] py-[var(--space-2)]',
  'text-[var(--color-text-inverse)] no-underline hover:bg-[var(--color-primary-hover)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
]

export const quietLinkClasses = ['underline hover:no-underline']
