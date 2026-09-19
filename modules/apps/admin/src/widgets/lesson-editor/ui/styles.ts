export const editorClasses = ['flex', 'flex-col', 'gap-[var(--space-4)]']

/* --------------------------------- Toolbar -------------------------------- */

export const toolbarActionsClasses = ['flex', 'flex-wrap', 'items-center', 'gap-[var(--space-2)]']

export const toolbarFactsClasses = ['flex', 'items-center', 'gap-[var(--space-2)]']

export const toolbarErrorClasses = ['text-[length:var(--text-sm)]', 'text-[var(--color-danger-fg)]']

/* --------------------------------- Outline -------------------------------- */

export const outlineClasses = [
  'flex flex-wrap items-center gap-[var(--space-2)]',
  'sticky top-0 z-[var(--z-sticky)] bg-[var(--color-page)]',
  'border-b border-[var(--color-border)] py-[var(--space-2)]',
]

export const outlineLinkClasses = [
  'rounded-[var(--radius-full)] px-[var(--space-3)] py-[var(--space-1)]',
  'text-[length:var(--text-sm)] text-[var(--color-text-muted)] no-underline',
  'bg-[var(--color-surface-sunken)] hover:text-[var(--color-text)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
]

/* -------------------------------- Document -------------------------------- */

export const documentClasses = [
  'flex flex-col gap-[var(--space-6)]',
  'w-full max-w-[var(--form-max)] mx-auto',
]

export const sectionClasses = ['flex flex-col gap-[var(--space-2)]', 'scroll-mt-[var(--space-8)]']

/* --------------------------------- Section -------------------------------- */

export const sectionHeaderClasses = [
  'group flex items-center gap-[var(--space-2)]',
  'border-b border-transparent focus-within:border-[var(--color-border)]',
]

export const sectionTitleClasses =
  'flex-1 min-w-0 m-0 border-0 bg-transparent px-0 shadow-none ' +
  'text-[length:var(--text-lg)] font-[var(--weight-semibold)] text-[var(--color-text)] ' +
  'focus-visible:outline-none'

export const menuTriggerClasses = [
  'grid place-items-center size-[var(--control-sm)] shrink-0',
  'rounded-[var(--radius-sm)] border-0 bg-transparent p-0',
  'text-[var(--color-text-muted)] opacity-0 hover:bg-[var(--color-surface-hover)]',
  'group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
]

export const menuClasses = ['flex flex-col min-w-[var(--menu-min-width)]']

export const menuItemClasses =
  'w-full justify-start h-[var(--control-sm)] px-[var(--space-2)] ' +
  'text-[length:var(--text-sm)] font-[var(--weight-regular)]'

export const menuHeadingClasses = [
  'm-0 px-[var(--space-2)] pt-[var(--space-2)]',
  'text-[length:var(--text-xs)] text-[var(--color-text-muted)]',
]

export const blockListClasses = ['flex flex-col']

export const addSectionClasses = ['pt-[var(--space-2)]']

// A quiet line the author can reach for at the end of a section, rather than a
// button that competes with the text above it.
export const insertBarClasses = [
  'w-full text-start border-0 bg-transparent',
  'px-[var(--space-8)] py-[var(--space-2)] rounded-[var(--radius-sm)]',
  'text-[length:var(--text-sm)] text-[var(--color-text-muted)]',
  'opacity-0 hover:opacity-100 focus-visible:opacity-100',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
]

/* -------------------------------- Problems -------------------------------- */

export const noticeClasses = [
  'flex flex-col gap-[var(--space-1)] rounded-[var(--radius-md)]',
  'border border-[var(--color-warning-border)] bg-[var(--color-warning-surface)]',
  'p-[var(--space-3)] text-[length:var(--text-sm)] text-[var(--color-warning-fg)]',
]

export const noticeListClasses = ['m-0', 'ps-[var(--space-4)]']

/* --------------------------------- Reading -------------------------------- */

export const readingClasses = ['w-full', 'max-w-[var(--prose-max)]', 'mx-auto']

export const previewClasses = ['flex', 'flex-col', 'gap-[var(--space-4)]']

export const previewSectionClasses = ['flex', 'flex-col', 'gap-[var(--space-3)]']

export const previewTitleClasses = [
  'text-[length:var(--text-md)]',
  'font-[var(--weight-semibold)]',
  'text-[var(--color-text)]',
]

export const previewBlockClasses = ['flex', 'flex-col', 'gap-[var(--space-2)]']

export const frameClasses = [
  'w-full',
  'aspect-video',
  'rounded-[var(--radius-md)]',
  'border',
  'border-[var(--color-border)]',
]

export const playerClasses = ['w-full', 'rounded-[var(--radius-md)]']

export const mutedClasses = ['text-[length:var(--text-sm)]', 'text-[var(--color-text-muted)]']

export const answersClasses = [
  'flex',
  'flex-col',
  'gap-[var(--space-1)]',
  'm-0',
  'ps-[var(--space-4)]',
]
