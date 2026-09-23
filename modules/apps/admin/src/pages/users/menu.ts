import type { MenuGroup } from '@/shared/navigation'

/** People in the school group. Owned by T2. */
export const menu: MenuGroup[] = [
  {
    label: 'nav-group-school',
    items: [{ route: 'users', label: 'nav-users', icon: 'users', permission: 'users:read' }],
  },
]
