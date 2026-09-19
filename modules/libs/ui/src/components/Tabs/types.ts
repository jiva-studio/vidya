export interface TabItem {
  value: string
  label: string
  disabled?: boolean
}

export type TabsVariant = 'line' | 'segmented'

export interface TabsProps {
  modelValue: string
  items: TabItem[]
  variant?: TabsVariant
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
