import type { MenuGroup } from '@/shared/navigation'

/**
 * The teaching group of the sidebar. Owned by T4.
 *
 * Requests and the homework queue are the two screens that are work rather than
 * setup, and the sidebar draws one heading per group, so both are named here
 * while each section still registers its own route and its own labels.
 */
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
      {
        route: 'homework-queue',
        label: 'nav-homework-queue',
        icon: 'check-square',
        permission: 'homework:read',
      },
    ],
  },
]
