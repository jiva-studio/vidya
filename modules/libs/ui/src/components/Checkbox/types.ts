export interface CheckboxProps {
  modelValue?: boolean
  label?: string
  description?: string
  disabled?: boolean
  indeterminate?: boolean
  id?: string
  class?: string
}

export interface CheckboxEmits {
  'update:modelValue': [value: boolean]
}
