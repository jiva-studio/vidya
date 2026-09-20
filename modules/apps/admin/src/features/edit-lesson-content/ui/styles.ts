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

// The block under the pointer shows how far it reaches: without it the handle
// beside it is an offer to move something whose extent nobody can see.
export const blockFrameClasses = [
  'group relative flex items-start gap-[var(--space-2)]',
  'rounded-[var(--radius-md)] py-[var(--space-1)]',
  'ps-[var(--space-6)] -ms-[var(--space-6)] pe-[var(--space-2)] -me-[var(--space-2)]',
  'transition-colors duration-[var(--duration-fast)] ease-[var(--ease)]',
  'hover:bg-[var(--color-surface-hover)]',
]

// The gutter lives inside the block's own padding rather than beside it: the
// strip it sits in is part of the block, so reaching for the handle from the
// margin brings it out instead of crossing dead space where it is still hidden.
export const gutterClasses = [
  'absolute start-0 top-[var(--space-1)] h-[1.6em]',
  'flex items-center gap-[var(--space-1)]',
]

export const gutterButtonClasses = [
  'grid place-items-center h-full w-[var(--control-sm)] shrink-0',
  'rounded-[var(--radius-sm)] border-0 bg-transparent p-0',
  'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
]

export const menuClasses = ['flex flex-col min-w-[var(--menu-min-width)]']

export const menuIconClasses = ['size-[var(--space-4)] shrink-0 text-[var(--color-text-muted)]']

// The button lays its slot out as text, so the row it holds is laid out through
// it: loose, the glyph and the label flow and the glyph drops onto a second
// line. Reaching into the slot keeps the row one element deep in the template.
export const menuItemClasses =
  'w-full justify-start h-[var(--control-sm)] px-[var(--space-2)] ' +
  'rounded-[var(--radius-sm)] text-[length:var(--text-sm)] font-[var(--weight-regular)] ' +
  '[&>span]:flex [&>span]:w-full [&>span]:items-center [&>span]:gap-[var(--space-2)]'

// The rule runs the full width of the panel, which the panel's own padding
// would otherwise inset it from.
export const menuSeparatorClasses = [
  '-mx-[var(--space-1)] my-[var(--space-1)] h-px bg-[var(--color-border)]',
]

// The menu is opened by a keystroke, not by a control, so it hangs off a point
// in the line the author is typing in rather than off a button.
export const insertAnchorClasses = ['absolute bottom-0 start-0 block w-0 h-0']

export const blockBodyClasses = ['min-w-0 flex-1 flex flex-col gap-[var(--space-2)]']

export const iconClasses = ['size-[var(--space-4)]']

/* ----------------------------------- Text ---------------------------------- */

export const textStackClasses = ['relative flex flex-col w-full']

export const sourceClasses = ['w-full text-[length:var(--text-base)] rounded-[var(--radius-sm)]']

export const placeholderClasses = [
  'pointer-events-none absolute inset-x-0 top-0 m-0',
  'text-[length:var(--text-base)] text-[var(--color-text-muted)]',
]

// Rendered markdown needs the shape the author typed: a heading has to look
// like a heading, or the block reads as one flat paragraph and the markdown was
// pointless. Written as descendant rules because the html arrives as a string.
export const markdownClasses = [
  'w-full text-[length:var(--text-base)] text-[var(--color-text)]',
  'flex flex-col gap-[var(--space-3)]',
  '[&_h1]:text-[length:var(--text-lg)] [&_h1]:font-[var(--weight-semibold)]',
  '[&_h2]:text-[length:var(--text-md)] [&_h2]:font-[var(--weight-semibold)]',
  '[&_h3]:text-[length:var(--text-base)] [&_h3]:font-[var(--weight-semibold)]',
  '[&_strong]:font-[var(--weight-semibold)] [&_em]:italic',
  '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-[var(--space-5)] [&_ol]:pl-[var(--space-5)]',
  '[&_li]:my-[var(--space-1)]',
  '[&_a]:text-[var(--color-primary)] [&_a]:underline',
  '[&_code]:rounded-[var(--radius-sm)] [&_code]:bg-[var(--color-surface-sunken)] [&_code]:px-[var(--space-1)]',
  '[&_blockquote]:border-l [&_blockquote]:border-[var(--color-border)] [&_blockquote]:pl-[var(--space-3)]',
  '[&_blockquote]:text-[var(--color-text-muted)]',
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

export const answerListClasses = ['flex flex-col list-none m-0 p-0 ps-[var(--space-2)]']

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

// The field grows with what is typed into it: one row that scrolls would hide
// the line the author is writing the moment they start a second one.
export const explanationClasses =
  'resize-none field-sizing-content border-0 bg-transparent px-0 py-0 min-h-0 shadow-none ' +
  'text-[length:var(--text-sm)] text-[var(--color-text-muted)] ' +
  'focus-visible:shadow-none focus-visible:outline-none'

/* --------------------------------- Unknown --------------------------------- */

export const unknownClasses = [
  'flex flex-col gap-[var(--space-1)] rounded-[var(--radius-md)]',
  'border border-[var(--color-warning-border)] bg-[var(--color-warning-surface)]',
  'p-[var(--space-3)] text-[length:var(--text-sm)] text-[var(--color-warning-fg)]',
]
