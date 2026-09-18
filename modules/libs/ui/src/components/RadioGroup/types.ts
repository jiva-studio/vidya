export interface RadioOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

export interface RadioGroupProps {
  modelValue?: string
  options: RadioOption[]
  orientation?: 'vertical' | 'horizontal'
  disabled?: boolean
  class?: string
}

export interface RadioGroupEmits {
  'update:modelValue': [value: string]
}

export interface RadioGroupItemProps {
  option: RadioOption
  class?: string
}
