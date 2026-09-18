import type { RouteRecordRaw } from 'vue-router'

/**
 * Routes for lessons. Owned by T3.
 *
 * Lessons belong to a course, so the course is in the path rather than in a
 * filter: a lessons screen with no course chosen has nothing to show.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/courses/:courseId/lessons',
    name: 'lessons',
    component: () => import('./ui/LessonsPage.vue'),
    meta: { permission: 'lessons:read', breadcrumbs: ['nav-courses', 'lessons-title'] },
  },
]
