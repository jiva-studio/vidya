// The column is inset by the width of a block's gutter, which hangs back into
// that inset: the heading, the text and the controls then share one left edge
// without the handle reaching over the shell's edge.
export const editorClasses = ['flex flex-col gap-[var(--space-4)]', 'w-full ps-[var(--space-7)]']

/* --------------------------------- Toolbar -------------------------------- */

export const titleClasses =
  'w-full min-w-0 border-0 bg-transparent px-0 shadow-none ' +
  'text-[length:var(--text-xl)] font-[var(--weight-semibold)] text-[var(--color-text)] ' +
  'focus-visible:shadow-none focus-visible:outline-none'

export const toolbarStatusClasses = [
  'me-[var(--space-2)]',
  'text-[length:var(--text-sm)]',
  'text-[var(--color-text-muted)]',
  'whitespace-nowrap',
]

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

export const documentClasses = ['flex flex-col gap-[var(--space-3)] w-full']

export const sectionClasses = ['flex flex-col gap-[var(--space-2)]', 'scroll-mt-[var(--space-8)]']

/* --------------------------------- Section -------------------------------- */

export const sectionHeaderClasses = ['group flex items-center gap-[var(--space-2)]']

export const sectionTitleClasses =
  'flex-1 min-w-0 m-0 border-0 bg-transparent px-0 shadow-none ' +
  'text-[length:var(--text-md)] font-[var(--weight-semibold)] text-[var(--color-text)] ' +
  'focus-visible:outline-none'

export const assessmentClasses = [
  'inline-flex shrink-0 items-center gap-[var(--space-1)]',
  'text-[length:var(--text-xs)] text-[var(--color-text-muted)]',
]

export const assessmentIconClasses = ['size-[var(--space-4)] shrink-0']

export const menuTriggerClasses = [
  'grid place-items-center size-[var(--control-sm)] shrink-0',
  'rounded-[var(--radius-sm)] border-0 bg-transparent p-0',
  'text-[var(--color-text-muted)] opacity-0 hover:bg-[var(--color-surface-hover)]',
  'group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
]

export const menuClasses = ['flex flex-col min-w-[var(--menu-min-width)]']

// The button lays its slot out as text, so the row it holds is laid out through
// it: loose, the glyph and the label flow and the glyph drops onto a second
// line. Reaching into the slot keeps the row one element deep in the template.
export const menuItemClasses =
  'w-full justify-start h-[var(--control-sm)] px-[var(--space-2)] ' +
  'rounded-[var(--radius-sm)] text-[length:var(--text-sm)] font-[var(--weight-regular)] ' +
  '[&>span]:flex [&>span]:w-full [&>span]:items-center [&>span]:justify-start [&>span]:gap-[var(--space-2)]'

export const menuIconClasses = ['size-[var(--space-4)] shrink-0 text-[var(--color-text-muted)]']

// The tick follows the label rather than leading it: the icon column says what
// the item is, and what is chosen is the one thing that changes with the state.
export const menuCheckClasses = [
  'ms-auto size-[var(--space-4)] shrink-0 opacity-0 data-[on]:opacity-100',
]

// The rule runs the full width of the panel, which the panel's own padding
// would otherwise inset it from.
export const menuSeparatorClasses = [
  '-mx-[var(--space-1)] my-[var(--space-1)] h-px bg-[var(--color-border)]',
]

export const menuHeadingClasses = [
  'm-0 px-[var(--space-2)] py-[var(--space-1)]',
  'text-[length:var(--text-xs)] text-[var(--color-text-muted)]',
]

export const blockListClasses = ['flex flex-col']

// A section that ends in a picture or a question has nowhere left to type, so
// it is shown the empty line it is missing, drawn and padded exactly as an
// empty text block is: clicking it turns it into one, and nothing moves.
export const tailClasses = [
  'w-full border-0 bg-transparent px-0 py-[var(--space-1)] text-start cursor-text',
  'text-[length:var(--text-base)] text-[var(--color-text-muted)]',
  'focus-visible:outline-none',
]

// Where one section ends and the next begins, which is where one piece of
// homework ends and the next begins. It is drawn as the line it is; the offer
// to open a section there arrives only under the pointer, so the document at
// rest carries no controls at all.
export const boundaryClasses = [
  'group/boundary relative flex w-full items-center justify-center',
  'border-0 bg-transparent px-0 py-[var(--space-2)]',
  'text-[length:var(--text-sm)] text-[var(--color-text-muted)]',
  'focus-visible:outline-none',
]

export const boundaryRuleClasses = ['absolute inset-x-0 h-px bg-[var(--color-border)]']

export const boundaryLabelClasses = [
  'relative inline-flex items-center gap-[var(--space-1)]',
  'bg-[var(--color-page)] px-[var(--space-2)] opacity-0',
  'transition-opacity duration-[var(--duration-fast)] ease-[var(--ease)]',
  'group-hover/boundary:opacity-100 group-focus-visible/boundary:opacity-100',
]

export const boundaryIconClasses = ['size-[var(--space-4)]']

/* -------------------------------- Problems -------------------------------- */

export const noticeClasses = [
  'flex flex-col gap-[var(--space-1)] rounded-[var(--radius-md)]',
  'border border-[var(--color-warning-border)] bg-[var(--color-warning-surface)]',
  'p-[var(--space-3)] text-[length:var(--text-sm)] text-[var(--color-warning-fg)]',
]

export const noticeListClasses = ['m-0', 'ps-[var(--space-4)]']

// The line names a block, so it takes the reader to it. Underlined rather than
// coloured: inside a warning panel a second colour says nothing.
export const noticeLinkClasses = [
  'border-0 bg-transparent p-0 text-inherit underline cursor-pointer',
  'text-start text-[length:var(--text-sm)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
]

/** The version the editor has open, beside the word for what is happening. */
export const toolbarVersionClasses = [
  'me-[var(--space-2)] rounded-[var(--radius-sm)]',
  'bg-[var(--color-surface-sunken)] px-[var(--space-2)] py-[var(--space-1)]',
  'text-[length:var(--text-xs)] text-[var(--color-text-muted)] whitespace-nowrap',
]
