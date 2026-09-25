import type { RouteRecordRaw } from 'vue-router'

/**
 * Routes for lessons.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/s/:schoolId/lessons',
    name: 'lessons',
    component: () => import('./ui/LessonsPage.vue'),
    meta: {
      section: 'courses',
      permission: 'lessons:read',
    },
  },
]
