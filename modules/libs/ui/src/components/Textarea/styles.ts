import { cva } from 'class-variance-authority'

import { fieldBase } from '../Input/styles'

export const textareaVariants = cva([...fieldBase, 'py-[var(--space-2)] px-[var(--space-3)]'], {
  variants: {
    invalid: { true: 'border-[var(--color-danger-border)]', false: '' },
  },
  defaultVariants: { invalid: false },
})
