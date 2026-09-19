export interface TextareaProps {
  modelValue?: string
  rows?: number
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  invalid?: boolean
  id?: string
  describedBy?: string
  class?: string
}

export interface TextareaEmits {
  'update:modelValue': [value: string]
  blur: [event: FocusEvent]
}
