export interface ComboboxOption {
  value: string
  label: string
  disabled?: boolean
}

export interface ComboboxProps {
  modelValue?: string
  options: ComboboxOption[]
  placeholder?: string
  emptyLabel?: string
  disabled?: boolean
  invalid?: boolean
  // Remote lists are searched on the server; the delay keeps one keystroke
  // from becoming one request. The archive's combobox did the same.
  searchDebounce?: number
  id?: string
  describedBy?: string
  class?: string
}

export interface ComboboxEmits {
  'update:modelValue': [value: string]
  search: [term: string]
}

export interface ComboboxListProps {
  options: ComboboxOption[]
  emptyLabel: string
}
