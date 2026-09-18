import type { MenuGroup } from '@/shared/navigation'

/**
 * Roles in the organisation group. Owned by T2.
 *
 * The heading is declared by every section that belongs under it and drawn
 * once: the composition root merges groups by label.
 */
export const menu: MenuGroup[] = [
  {
    label: 'nav-group-org',
    items: [{ route: 'roles', label: 'nav-roles', icon: 'shield', permission: 'roles:read' }],
  },
]
