import { cva } from 'class-variance-authority'

export const zoneVariants = cva(
  [
    'w-full flex flex-col items-center justify-center gap-[var(--space-2)]',
    'p-[var(--space-5)] rounded-[var(--radius-md)]',
    'border border-dashed text-center',
    'transition-colors duration-[var(--duration-fast)] ease-[var(--ease)]',
  ],
  {
    variants: {
      state: {
        idle: 'border-[var(--color-border-strong)] bg-[var(--color-surface)]',
        dragging: 'border-[var(--color-primary)] bg-[var(--color-primary-surface)]',
        refused: 'border-[var(--color-danger-border)] bg-[var(--color-danger-surface)]',
      },
      disabled: { true: 'opacity-50 pointer-events-none', false: '' },
    },
    defaultVariants: { state: 'idle', disabled: false },
  },
)

export const labelClasses = [
  'text-[length:var(--text-base)] text-[var(--color-text)]',
  'font-[var(--weight-medium)]',
]

export const hintClasses = ['text-[length:var(--text-sm)] text-[var(--color-text-muted)]']

export const refusedClasses = ['text-[length:var(--text-sm)] text-[var(--color-danger-fg)]']
