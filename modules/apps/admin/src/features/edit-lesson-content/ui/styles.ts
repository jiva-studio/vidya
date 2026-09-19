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

export const blockFrameClasses = [
  'group relative flex items-start gap-[var(--space-2)]',
  'ps-[var(--space-8)] rounded-[var(--radius-md)] py-[var(--space-1)]',
]

// The gutter sits outside the reading column so the text keeps the same left
// edge whether or not the pointer is anywhere near it.
export const gutterClasses = [
  'absolute start-0 top-[var(--space-1)]',
  'flex items-center gap-[var(--space-1)]',
]

export const gutterButtonClasses = [
  'grid place-items-center size-[var(--control-sm)] shrink-0',
  'rounded-[var(--radius-sm)] border-0 bg-transparent p-0',
  'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
]

export const menuClasses = ['flex flex-col min-w-[var(--menu-min-width)]']

export const menuItemClasses =
  'w-full justify-start h-[var(--control-sm)] px-[var(--space-2)] ' +
  'text-[length:var(--text-sm)] font-[var(--weight-regular)]'

export const blockBodyClasses = ['min-w-0 flex-1 flex flex-col gap-[var(--space-2)]']

export const iconClasses = ['size-[var(--space-4)]']

/* ----------------------------------- Text ---------------------------------- */

export const textStackClasses = ['relative flex flex-col w-full']

export const sourceClasses = [
  'w-full min-h-[var(--space-6)] text-[length:var(--text-base)]',
  'rounded-[var(--radius-sm)]',
]

// Out of the way of the reader but still in the page: a source behind
// `display: none` could not take the caret from a click or from a deletion.
export const sourceTuckedClasses = ['absolute inset-0 w-full h-full overflow-hidden opacity-0']

export const placeholderClasses = [
  'm-0 text-[length:var(--text-base)] text-[var(--color-text-muted)]',
]

export const markdownClasses = [
  'max-w-[var(--prose-max)] text-[length:var(--text-base)] text-[var(--color-text)]',
]

/* ---------------------------------- Media ---------------------------------- */

export const fieldStackClasses = ['flex', 'flex-col', 'gap-[var(--space-3)]']

/* ----------------------------------- Quiz ---------------------------------- */

export const quizClasses = ['flex', 'flex-col', 'gap-[var(--space-1)]']

// The question and the options are text on a page, not fields in a form: the
// chrome arrives on hover and focus, so the quiz reads the way it will be read.
const bareInputClasses =
  'flex-1 min-w-0 h-auto border-0 bg-transparent px-0 shadow-none ' +
  'focus-visible:shadow-none focus-visible:outline-none'

export const questionClasses =
  `${bareInputClasses} text-[length:var(--text-md)] font-[var(--weight-semibold)] ` +
  'text-[var(--color-text)]'

export const answerTextClasses = bareInputClasses

export const newAnswerClasses = `${bareInputClasses} text-[var(--color-text-muted)]`

export const answerListClasses = ['flex flex-col gap-[var(--space-1)] list-none m-0 p-0']

export const answerRowClasses = ['group/answer flex items-center gap-[var(--space-2)]']

export const answerGripClasses = [
  'shrink-0 cursor-grab text-[var(--color-text-muted)] opacity-0',
  'transition-opacity duration-[var(--duration-fast)] ease-[var(--ease)]',
  'group-hover/answer:opacity-100 group-focus-within/answer:opacity-100',
]

export const answerActionsClasses = [
  'shrink-0 w-[var(--control-sm)] grid place-items-center opacity-0 transition-opacity duration-[var(--duration-fast)] ease-[var(--ease)]',
  'group-hover/answer:opacity-100 group-focus-within/answer:opacity-100',
]

export const explanationClasses =
  'resize-none border-0 bg-transparent px-0 shadow-none ' +
  'text-[length:var(--text-sm)] text-[var(--color-text-muted)] ' +
  'focus-visible:shadow-none focus-visible:outline-none'

/* --------------------------------- Unknown --------------------------------- */

export const unknownClasses = [
  'flex flex-col gap-[var(--space-1)] rounded-[var(--radius-md)]',
  'border border-[var(--color-warning-border)] bg-[var(--color-warning-surface)]',
  'p-[var(--space-3)] text-[length:var(--text-sm)] text-[var(--color-warning-fg)]',
]
