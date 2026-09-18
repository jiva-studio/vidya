import type { RouteRecordRaw } from 'vue-router'

/**
 * Routes for the homework review screen. Owned by T4.
 *
 * One address for one work, with room to read it and decide on it. "Next"
 * moves to the next address rather than to another state of this one, so every
 * work a reviewer passes through can be linked to.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/s/:schoolId/homework/:id',
    name: 'homework-review',
    props: true,
    component: () => import('./ui/HomeworkReviewPage.vue'),
    meta: {
      section: 'homework-queue',
      permission: 'homework:read',
      breadcrumbs: ['nav-homework-queue', 'homework-one'],
    },
  },
]
