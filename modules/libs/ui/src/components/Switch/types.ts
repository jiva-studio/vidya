export interface SwitchProps {
  modelValue?: boolean
  label?: string
  description?: string
  disabled?: boolean
  id?: string
  class?: string
}

export interface SwitchEmits {
  'update:modelValue': [value: boolean]
}
