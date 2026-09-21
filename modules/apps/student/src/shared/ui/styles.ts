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

export const shellClasses = ['flex min-h-full flex-col']

export const navClasses = [
  'flex items-center gap-[var(--space-4)]',
  'border-b border-[var(--color-border)] px-[var(--space-4)] py-[var(--space-3)]',
]

export const navLinkClasses = ['text-[length:var(--text-sm)] hover:underline']

export const contentClasses = ['flex-1 p-[var(--space-4)]']

export const sectionClasses = ['flex flex-col gap-[var(--space-2)]']

export const backfillClasses = [
  'flex flex-col items-start gap-[var(--space-2)]',
  'rounded-[var(--radius-md)] border border-[var(--color-border)] p-[var(--space-4)]',
]
