import type { MenuGroup } from '@/shared/navigation'

/**
 * Courses in the teaching-material group. Owned by T3.
 *
 * Lessons are reached through their course rather than from the sidebar: a
 * lessons list with no course chosen has nothing to show.
 */
export const menu: MenuGroup[] = [
  {
    label: 'nav-group-edu',
    items: [{ route: 'courses', label: 'nav-courses', icon: 'book', permission: 'courses:read' }],
  },
]
