// The two steps hold a different number of controls, so without a floor the
// page jumps the moment the code is asked for. The floor is the taller step.
export const formClasses = [
  'flex w-full flex-col gap-[var(--space-4)]',
  'min-h-[15rem] justify-start',
]

export const codeInputClasses = 'font-[family-name:var(--font-mono)] tracking-[0.4em]'

export const secondaryRowClasses = [
  'flex flex-wrap items-center justify-between gap-[var(--space-2)]',
]

export const linkButtonClasses = [
  'text-[length:var(--text-sm)]',
  'text-[var(--color-text-muted)]',
  'underline-offset-2',
  'hover:underline',
  'disabled:no-underline',
  'disabled:opacity-60',
]
