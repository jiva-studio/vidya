import type { MenuGroup } from '@/shared/navigation'

/** Groups in the teaching-material group. Owned by T3. */
export const menu: MenuGroup[] = [
  {
    label: 'nav-group-edu',
    items: [{ route: 'groups', label: 'nav-groups', icon: 'layers', permission: 'groups:read' }],
  },
]
