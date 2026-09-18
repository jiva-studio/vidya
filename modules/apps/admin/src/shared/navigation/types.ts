import type { PermissionKey } from '@vidya/domain'

/** One entry in the sidebar, declared by the section that owns the screen. */
export interface MenuItem {
  /** Route name the entry leads to. */
  readonly route: string

  /** Fluent key for the label; sections ship both languages with it. */
  readonly label: string

  /** Name of the icon in the shared set. */
  readonly icon: string

  /** Hidden when the current school does not grant this. Always shown when absent. */
  readonly permission?: PermissionKey
}

/** Sidebar entries are grouped; the group is a heading, not a link. */
export interface MenuGroup {
  readonly label: string
  readonly items: readonly MenuItem[]
}
