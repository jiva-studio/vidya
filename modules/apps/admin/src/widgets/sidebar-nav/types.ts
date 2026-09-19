import type { MenuGroup } from '@/shared/navigation'

export interface SidebarNavProps {
  /** Every group the sections declared; the component drops what is not granted. */
  readonly groups: readonly MenuGroup[]
}
