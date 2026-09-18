export const pageClasses = ['flex', 'flex-col', 'gap-[--space-5]']

export const rowActionsClasses = 'flex items-center justify-end gap-[--space-2]'

export const formClasses = [
  'flex',
  'flex-col',
  'gap-[--space-5]',
  // A form has no width token of its own yet; until libs/ui grows one it
  // takes the width of the content area rather than an invented number.
  'rounded-[--radius-lg]',
  'border',
  'border-[--color-border]',
  'bg-[--color-surface]',
  'p-[--space-5]',
]

export const formLoadingClasses = ['flex', 'flex-col', 'gap-[--space-4]']
