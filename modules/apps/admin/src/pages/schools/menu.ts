import type { MenuGroup } from '@/shared/navigation'

/**
 * The organisation group of the sidebar. Owned by T2.
 *
 * All three org screens share one heading, and the sidebar draws a heading per
 * group, so the group is declared once here rather than three times — the
 * routes it names are still registered by the sections that own them, and the
 * labels still live in those sections' own resources.
 */
export const menu: MenuGroup[] = [
  {
    label: 'nav-group-org',
    items: [
      { route: 'schools', label: 'nav-schools', icon: 'building', permission: 'schools:read' },
      { route: 'roles', label: 'nav-roles', icon: 'shield', permission: 'roles:read' },
      { route: 'users', label: 'nav-users', icon: 'users', permission: 'users:read' },
    ],
  },
]
