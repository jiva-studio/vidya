import type { MenuGroup } from '@/shared/navigation'

/** Requests in the teaching group. Owned by T4. */
export const menu: MenuGroup[] = [
  {
    label: 'nav-group-process',
    items: [
      {
        route: 'enrollments',
        label: 'nav-enrollments',
        icon: 'inbox',
        permission: 'enrollments:read',
      },
    ],
  },
]
