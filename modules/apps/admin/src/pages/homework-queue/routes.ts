import type { RouteRecordRaw } from 'vue-router'

/**
 * Routes for the homework queue. Owned by T4.
 *
 * One address for the whole of reviewing: the list and the work sit on the same
 * screen, so deciding on one work does not navigate anywhere.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/homework',
    name: 'homework-queue',
    component: () => import('./ui/HomeworkQueuePage.vue'),
    meta: { permission: 'homework:read', breadcrumbs: ['nav-homework-queue'] },
  },
]
