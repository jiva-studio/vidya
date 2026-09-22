import type { RouteRecordRaw } from 'vue-router'

/**
 * Routes for enrollments. Owned by T4.
 *
 * One screen and no form: a request is made by the student from the phone —
 * `POST /edu/enrollments` enrols whoever is signed in — so there is nothing
 * here to create, only requests to decide on.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/s/:schoolId/enrollments',
    name: 'enrollments',
    component: () => import('./ui/EnrollmentsPage.vue'),
    meta: { permission: 'enrollments:read' },
  },
]
