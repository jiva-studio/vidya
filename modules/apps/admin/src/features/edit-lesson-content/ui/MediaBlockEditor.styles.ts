/* ------------------------------- Media block ------------------------------ */

export const mediaBlockClasses = ['flex', 'flex-col', 'gap-[var(--space-3)]']

export const mediaRowClasses = ['flex', 'flex-wrap', 'items-center', 'gap-[var(--space-2)]']

export const mediaPlayerClasses = [
  'w-full max-w-[var(--prose-max)] rounded-[var(--radius-md)]',
  'bg-[var(--color-surface-hover)]',
]

export const mediaFrameClasses = [
  'w-full max-w-[var(--prose-max)] aspect-video rounded-[var(--radius-md)] border-0',
]

export const mediaMutedClasses = ['m-0 text-[length:var(--text-sm)] text-[var(--color-text-muted)]']

export const mediaAlertClasses = ['m-0 text-[length:var(--text-sm)] text-[var(--color-danger-fg)]']

/* A line of the document, not a box on it. */
export const emptyRowClasses = [
  'flex items-center gap-[var(--space-2)] w-fit',
  'border-0 bg-transparent p-0 text-left',
  'text-[length:var(--text-base)] text-[var(--color-text-muted)]',
  'hover:text-[var(--color-text)] disabled:cursor-default',
  'data-[dragging]:text-[var(--color-primary)]',
]

export const emptyIconClasses = ['size-[var(--space-4)] shrink-0']
