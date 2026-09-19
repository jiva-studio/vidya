export type FormFooterAlign = 'start' | 'end' | 'between'

export interface FormFooterProps {
  submitLabel?: string
  cancelLabel?: string
  busy?: boolean
  disabled?: boolean
  destructive?: boolean
  align?: FormFooterAlign
  error?: string
  class?: string
}

export interface FormFooterEmits {
  submit: []
  cancel: []
}
