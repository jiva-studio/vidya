import type { MenuGroup } from '@/shared/navigation'

/** Schools in the organisation group. Owned by T2. */
export const menu: MenuGroup[] = [
  {
    label: 'nav-group-org',
    items: [
      { route: 'schools', label: 'nav-schools', icon: 'building', permission: 'schools:read' },
    ],
  },
]
