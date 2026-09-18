export const formClasses = ['flex', 'w-full', 'flex-col', 'gap-[--space-4]']

export const labelClasses = [
  'text-[length:--text-xs]',
  'font-[--weight-medium]',
  'text-[--color-text-muted]',
]

export const inputClasses = [
  'h-[--control-lg]',
  'w-full',
  'rounded-[--radius-md]',
  'border',
  'border-[--color-border-strong]',
  'bg-[--color-surface]',
  'px-[--space-3]',
  'text-[length:--text-base]',
  'text-[--color-text]',
  'outline-none',
  'focus:shadow-[--focus-ring]',
]

export const codeInputClasses = [
  ...inputClasses,
  'font-[family-name:--font-mono]',
  'tracking-[0.4em]',
]

export const primaryButtonClasses = [
  'h-[--control-lg]',
  'rounded-[--radius-md]',
  'bg-[--color-primary]',
  'px-[--space-4]',
  'text-[length:--text-base]',
  'font-[--weight-medium]',
  'text-[--color-text-inverse]',
  'transition-colors',
  'duration-[--duration-normal]',
  'hover:bg-[--color-primary-hover]',
  'disabled:opacity-50',
]

export const linkButtonClasses = [
  'text-[length:--text-sm]',
  'text-[--color-text-muted]',
  'underline-offset-2',
  'hover:underline',
  'disabled:no-underline',
  'disabled:opacity-60',
]

export const hintClasses = ['text-[length:--text-sm]', 'text-[--color-text-muted]']

export const errorClasses = [
  'rounded-[--radius-md]',
  'border',
  'border-[--color-danger-border]',
  'bg-[--color-danger-surface]',
  'px-[--space-3]',
  'py-[--space-2]',
  'text-[length:--text-sm]',
  'text-[--color-danger-fg]',
]
