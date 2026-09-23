import type { MenuGroup } from '@/shared/navigation'

/** Schools and settings in the organisation and school groups. */
export const menu: MenuGroup[] = [
  {
    label: 'nav-group-org',
    items: [
      { route: 'schools', label: 'nav-schools', icon: 'building', permission: 'schools:create' },
    ],
  },
]
