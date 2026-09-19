export const actionsClasses = [
  'flex',
  'flex-wrap',
  'items-end',
  'gap-[var(--space-4)]',
  'border-t',
  'border-[var(--color-border)]',
  'pt-[var(--space-4)]',
]

export const pickerClasses = ['flex', 'flex-wrap', 'items-center', 'gap-[var(--space-2)]']

// Three digits and no more: a mark is not a sentence, and the browser's spinner
// arrows a number field would bring are not how a person enters one.
export const fieldClasses = 'w-[var(--menu-min-width)]'

export const marksClasses = ['flex', 'flex-wrap', 'gap-[var(--space-1)]']

export const errorClasses = [
  'basis-full',
  'text-[length:var(--text-sm)]',
  'text-[var(--color-danger-fg)]',
]
