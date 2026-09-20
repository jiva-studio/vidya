/* --------------------------------- Dialog --------------------------------- */

export const panelClasses = ['flex', 'flex-col', 'gap-[var(--space-3)]']

/* --------------------------------- Library -------------------------------- */

// Three columns, because the dialog is `lg` and no new size is introduced for it.
export const gridClasses = [
  'grid',
  'grid-cols-3',
  'gap-[var(--space-3)]',
  'list-none',
  'm-0',
  'p-0',
]

export const tileButtonClasses = [
  'flex flex-col gap-[var(--space-1)] w-full text-start',
  'rounded-[var(--radius-md)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
]

export const tileNameClasses = ['truncate text-[length:var(--text-sm)] text-[var(--color-text)]']

/* --------------------------------- Upload --------------------------------- */

export const uploadClasses = ['flex', 'flex-col', 'gap-[var(--space-3)]']

export const hiddenInputClasses = ['sr-only']
