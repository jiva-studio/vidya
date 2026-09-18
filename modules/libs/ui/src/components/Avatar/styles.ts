import { cva } from 'class-variance-authority'

export const avatarVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center overflow-hidden',
    'rounded-[var(--radius-full)] select-none',
    'bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]',
    'font-[var(--weight-medium)] uppercase',
  ],
  {
    variants: {
      size: {
        sm: 'size-[var(--control-sm)] text-[length:var(--text-2xs)]',
        md: 'size-[var(--control-md)] text-[length:var(--text-xs)]',
        lg: 'size-[var(--control-lg)] text-[length:var(--text-sm)]',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export const imageClasses = ['size-full object-cover']
