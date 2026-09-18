export type InputSize = 'md' | 'lg'

export interface InputProps {
  modelValue?: string | number
  type?: string
  size?: InputSize
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  invalid?: boolean
  id?: string
  describedBy?: string
  autocomplete?: string
  inputmode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'url' | 'search'
  class?: string
}

export interface InputEmits {
  'update:modelValue': [value: string]
  blur: [event: FocusEvent]
}
