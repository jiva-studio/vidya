import type { MenuGroup } from '@/shared/navigation'

/** Roles in the school group. Owned by T2. */
export const menu: MenuGroup[] = [
  {
    label: 'nav-group-school',
    items: [{ route: 'roles', label: 'nav-roles', icon: 'shield', permission: 'roles:read' }],
  },
]
