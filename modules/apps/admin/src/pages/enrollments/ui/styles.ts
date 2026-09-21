export const sectionClasses = ['grid', 'gap-[var(--space-5)]']

export const filtersClasses = ['flex', 'flex-wrap', 'items-end', 'gap-[var(--space-3)]']

export const filterClasses = 'w-[12rem]'

// The name and when it was asked for are two facts and stack; a decision and
// its date are one, and read across.
export const stackClasses = ['flex flex-col items-start gap-[var(--space-1)]']

export const decisionClasses = ['flex flex-wrap items-baseline gap-[var(--space-2)]']

export const primaryLineClasses = ['whitespace-nowrap']

export const secondaryLineClasses = [
  'text-[length:var(--text-xs)] text-[var(--color-text-muted)] whitespace-nowrap',
]

export const refusalLineClasses = [
  'text-[length:var(--text-xs)] text-[var(--color-text-danger)] text-right',
]

// A refusal of a decision taken from a row, which has no dialog to land in.
export const refusalClasses = ['text-[length:var(--text-sm)]', 'text-[var(--color-danger-fg)]']
