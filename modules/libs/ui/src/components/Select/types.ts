export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps {
  modelValue?: string
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  id?: string
  describedBy?: string
  class?: string
}

export interface SelectEmits {
  'update:modelValue': [value: string]
}

export interface SelectListProps {
  options: SelectOption[]
}
