import type { RouteRecordRaw } from 'vue-router'

/**
 * Routes for the homework list. Owned by T4.
 *
 * The list and nothing else: a row leads to `/homework/:id`, where one work is
 * read and decided on with room to do it.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/s/:schoolId/homework',
    name: 'homework-queue',
    component: () => import('./ui/HomeworkQueuePage.vue'),
    meta: { permission: 'homework:read', breadcrumbs: ['nav-homework-queue'] },
  },
]
