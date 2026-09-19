export interface AlertDialogProps {
  open?: boolean
  title: string
  // Name the consequence. "Are you sure?" tells the reader nothing they can act on.
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
  class?: string
}

export interface AlertDialogEmits {
  'update:open': [open: boolean]
  confirm: []
  cancel: []
}

export interface AlertDialogActionsProps {
  confirmLabel: string
  cancelLabel: string
  destructive?: boolean
  busy?: boolean
  class?: string
}

export interface AlertDialogActionsEmits {
  confirm: []
  cancel: []
}
