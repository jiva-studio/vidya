import type { Component } from 'vue'

export interface CommandItem {
  value: string
  label: string
  description?: string

  /** Rendered at the head of the row. */
  icon?: Component
  disabled?: boolean
}

export interface CommandMenuProps {
  items: CommandItem[]
  term?: string
  placeholder: string
  emptyLabel: string
  label: string
  class?: string
}

export interface CommandMenuEmits {
  select: [value: string]
  'update:term': [term: string]
  close: []
}

export interface CommandMenuItemProps {
  item: CommandItem
}
