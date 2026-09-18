import { cva } from 'class-variance-authority'

export const skeletonVariants = cva(['animate-pulse bg-[var(--color-surface-sunken)] w-full'], {
  variants: {
    shape: {
      text: 'h-[var(--space-3)] rounded-[var(--radius-sm)]',
      block: 'h-[var(--row-height)] rounded-[var(--radius-md)]',
      circle: 'size-[var(--control-lg)] rounded-[var(--radius-full)]',
    },
  },
  defaultVariants: { shape: 'text' },
})

export const stackClasses = ['flex flex-col gap-[var(--space-2)] w-full']
