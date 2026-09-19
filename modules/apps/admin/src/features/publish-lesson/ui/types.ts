export interface PublishDialogProps {
  open?: boolean
  /** The version number about to be frozen, shown so nobody publishes the wrong one. */
  version: number
  busy?: boolean
  error?: string
}

export interface PublishDialogEmits {
  'update:open': [open: boolean]
  confirm: []
}
