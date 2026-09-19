import type { MenuGroup } from '@/shared/navigation'

/** People in the organisation group. Owned by T2. */
export const menu: MenuGroup[] = [
  {
    label: 'nav-group-org',
    items: [{ route: 'users', label: 'nav-users', icon: 'users', permission: 'users:read' }],
  },
]
