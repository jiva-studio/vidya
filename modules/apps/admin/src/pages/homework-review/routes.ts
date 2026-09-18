import type { RouteRecordRaw } from 'vue-router'

/**
 * Routes for the homework review screen. Owned by T4.
 *
 * An address for one work, so a link can point at it. It opens the same
 * workplace with that work already selected rather than a screen of its own:
 * deciding on it and carrying on with the queue is the same job.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/homework/:id',
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
