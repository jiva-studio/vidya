/* --------------------------------- Section -------------------------------- */

export const sectionFormClasses = ['flex', 'flex-col', 'gap-[var(--space-2)]']

export const sectionHeadingClasses = [
  'group flex items-center gap-[var(--space-2)]',
  'border-b border-transparent focus-within:border-[var(--color-border)]',
]

export const sectionTitleInputClasses =
  'flex-1 min-w-0 h-auto border-0 bg-transparent px-0 shadow-none ' +
  'text-[length:var(--text-lg)] font-[var(--weight-semibold)] text-[var(--color-text)] ' +
  'focus-visible:shadow-none focus-visible:outline-none'

export const propertyRowClasses = [
  'flex flex-wrap items-center gap-[var(--space-2)]',
  'text-[length:var(--text-sm)] text-[var(--color-text-muted)]',
]

export const propertyControlClasses = 'w-[var(--search-width)] max-w-full'

export const hintClasses = ['m-0 text-[length:var(--text-sm)] text-[var(--color-text-muted)]']

/* ---------------------------------- Blocks --------------------------------- */

export const blocksClasses = ['flex', 'flex-col', 'gap-[var(--space-2)]']

export const blockShellClasses = [
  'group flex items-start gap-[var(--space-2)]',
  'rounded-[var(--radius-md)] px-[var(--space-2)] py-[var(--space-1)]',
  'transition-colors duration-[var(--duration-fast)] ease-[var(--ease)]',
  'hover:bg-[var(--color-surface-hover)] focus-within:bg-[var(--color-surface-hover)]',
]

export const blockBodyClasses = ['min-w-0 flex-1 flex flex-col gap-[var(--space-2)]']

export const actionsClasses = [
  'flex items-center gap-[var(--space-1)] shrink-0',
  'opacity-0 transition-opacity duration-[var(--duration-fast)] ease-[var(--ease)]',
  'group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100',
]

export const addRowClasses = ['flex items-center gap-[var(--space-2)]']

export const addTriggerClasses =
  'w-auto h-[var(--control-sm)] grid-flow-col gap-[var(--space-1)] px-[var(--space-2)] ' +
  'text-[length:var(--text-sm)]'

export const iconClasses = ['size-[var(--space-4)]']

/* ----------------------------------- Text ---------------------------------- */

export const readableClasses = [
  'w-full text-start rounded-[var(--radius-sm)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
]

export const placeholderClasses = [
  'm-0 text-[length:var(--text-base)] text-[var(--color-text-muted)]',
]

export const markdownClasses = [
  'max-w-[var(--prose-max)] text-[length:var(--text-base)] text-[var(--color-text)]',
]

/* ---------------------------------- Media ---------------------------------- */

export const fieldStackClasses = ['flex', 'flex-col', 'gap-[var(--space-3)]']

/* ----------------------------------- Quiz ---------------------------------- */

export const answersGroupClasses = ['flex', 'flex-col', 'gap-[var(--space-1)]', 'items-start']

export const groupLabelClasses = [
  'text-[length:var(--text-sm)] font-[var(--weight-medium)] text-[var(--color-text)]',
]

export const answerListClasses = ['flex flex-col gap-[var(--space-1)] list-none m-0 p-0']

export const answerRowClasses = ['group/answer flex items-center gap-[var(--space-2)]']

export const answerActionsClasses = [
  'shrink-0 w-[var(--control-sm)] grid place-items-center opacity-0 transition-opacity duration-[var(--duration-fast)] ease-[var(--ease)]',
  'group-hover/answer:opacity-100 group-focus-within/answer:opacity-100',
]

/* --------------------------------- Unknown --------------------------------- */

export const unknownClasses = [
  'flex flex-col gap-[var(--space-1)] rounded-[var(--radius-md)]',
  'border border-[var(--color-warning-border)] bg-[var(--color-warning-surface)]',
  'p-[var(--space-3)] text-[length:var(--text-sm)] text-[var(--color-warning-fg)]',
]
