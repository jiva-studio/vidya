import { cva } from 'class-variance-authority'

export const tileVariants = cva(
  [
    'relative block w-full aspect-video overflow-hidden',
    'rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)]',
    'border border-[var(--color-border)]',
  ],
  {
    variants: {
      selected: {
        true: 'border-[var(--color-primary)] shadow-[var(--focus-ring)]',
        false: '',
      },
    },
    defaultVariants: { selected: false },
  },
)

export const imageClasses = ['size-full object-cover']

export const placeholderClasses = [
  'size-full grid place-items-center text-[var(--color-text-muted)]',
]

export const iconClasses = ['size-[var(--space-5)]']
