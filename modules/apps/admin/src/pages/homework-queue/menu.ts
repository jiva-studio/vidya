import type { MenuGroup } from '@/shared/navigation'

/** The homework queue in the teaching group. Owned by T4. */
export const menu: MenuGroup[] = [
  {
    label: 'nav-group-process',
    items: [
      {
        route: 'homework-queue',
        label: 'nav-homework-queue',
        icon: 'check-square',
        permission: 'homework:read',
      },
    ],
  },
]
