import type { MenuGroup } from '@/shared/navigation'

/**
 * Sidebar entries for groups. Owned by T3.
 *
 * Declared under the same heading as courses; the composition root gathers the
 * sections, so the two entries meet only there.
 */
export const menu: MenuGroup[] = [
  {
    label: 'nav-group-edu',
    items: [{ route: 'groups', label: 'nav-groups', icon: 'users', permission: 'groups:read' }],
  },
]
