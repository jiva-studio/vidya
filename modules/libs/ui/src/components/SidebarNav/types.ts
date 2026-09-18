import type { Component } from 'vue'

export interface SidebarNavItem {
  key: string
  label: string
  // A path, not a route object: the library knows nothing about the router.
  href?: string
  icon?: Component
  badge?: string
  active?: boolean
  disabled?: boolean
}

export interface SidebarNavGroupData {
  key: string
  label?: string
  items: SidebarNavItem[]
}

export interface SidebarNavProps {
  groups: SidebarNavGroupData[]
  label?: string
  class?: string
}

export interface SidebarNavEmits {
  select: [key: string]
}

export interface SidebarGroupProps {
  group: SidebarNavGroupData
  class?: string
}

export interface SidebarGroupEmits {
  select: [key: string]
}

export interface SidebarItemProps {
  item: SidebarNavItem
  class?: string
}

export interface SidebarItemEmits {
  select: [key: string]
}
