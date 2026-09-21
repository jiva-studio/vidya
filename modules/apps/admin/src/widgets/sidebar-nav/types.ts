import type { RouteLocationRaw } from 'vue-router'

import type { MenuGroup } from '@/shared/navigation'

export interface SidebarNavProps {
  /** Every group the sections declared; the component drops what is not granted. */
  readonly groups: readonly MenuGroup[]
}

/** The page open under this entry, when the reader is on one. */
export interface SidebarEntryChild {
  readonly label: string
  readonly to: RouteLocationRaw
}

export interface SidebarEntryProps {
  readonly label: string
  readonly to: RouteLocationRaw
  readonly child?: SidebarEntryChild
}
