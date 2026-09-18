export type FormActionsAlign = 'start' | 'end' | 'between'

export interface FormActionsProps {
  submitLabel?: string
  cancelLabel?: string
  busy?: boolean
  disabled?: boolean
  destructive?: boolean
  align?: FormActionsAlign
  error?: string
  class?: string
}

export interface FormActionsEmits {
  submit: []
  cancel: []
}
