export interface TabItem {
  value: string
  label: string
  disabled?: boolean
}

export interface TabsProps {
  modelValue: string
  items: TabItem[]
  label?: string
  class?: string
}

export interface TabsEmits {
  'update:modelValue': [value: string]
}

export interface TabsPanelProps {
  value: string
  class?: string
}
