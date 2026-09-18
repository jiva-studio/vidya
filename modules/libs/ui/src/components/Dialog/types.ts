export type DialogSize = 'md' | 'lg'

// The footer slot is laid out by DialogFooter, which the caller puts inside it.
// Keeping the wrapper in the caller's hands is what holds the dialog's own
// template within the depth the style rules allow.
export interface DialogProps {
  open?: boolean
  title: string
  description?: string
  size?: DialogSize
  closeLabel?: string
  class?: string
}

export interface DialogEmits {
  'update:open': [open: boolean]
}

export interface DialogHeaderProps {
  title: string
  description?: string
  closeLabel?: string
  class?: string
}

export interface DialogFooterProps {
  class?: string
}
