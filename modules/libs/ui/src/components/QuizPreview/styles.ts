export const answersClasses = [
  'flex',
  'flex-col',
  'gap-[var(--space-1)]',
  'm-0',
  'ps-[var(--space-4)]',
]

export const rightAnswerClasses = ['text-[length:var(--text-sm)]', 'text-[var(--color-text-muted)]']

export const optionClasses = ['flex', 'items-center', 'gap-[var(--space-2)]']

export const recordedClasses = ['text-[length:var(--text-sm)]', 'text-[var(--color-text-muted)]']

export const verdictClasses = (correct: boolean): string[] => [
  'text-[length:var(--text-sm)]',
  'font-[var(--weight-semibold)]',
  correct ? 'text-[var(--color-success-fg)]' : 'text-[var(--color-danger-fg)]',
]

export const explanationClasses = ['text-[length:var(--text-sm)]', 'text-[var(--color-text-muted)]']
