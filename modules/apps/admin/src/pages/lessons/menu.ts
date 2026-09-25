import type { MenuGroup } from '@/shared/navigation'

/**
 * Lessons in the teaching-material group.
 */
export const menu: MenuGroup[] = [
  {
    label: 'nav-group-edu',
    items: [
      {
        route: 'lessons',
        label: 'nav-lessons',
        icon: 'book',
        permission: 'lessons:read',
      },
    ],
  },
]
