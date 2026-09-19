export interface DropdownMenuItemData {
  value: string
  label: string
  destructive?: boolean
  disabled?: boolean
  // A rule stands above the item it precedes; row menus group read from write.
  separatorBefore?: boolean
}

export interface DropdownMenuProps {
  items: DropdownMenuItemData[]
  align?: 'start' | 'end'
  label?: string
  class?: string
}

export interface DropdownMenuEmits {
  select: [value: string]
}

export interface DropdownMenuItemsProps {
  items: DropdownMenuItemData[]
}

export interface DropdownMenuItemsEmits {
  select: [value: string]
}
