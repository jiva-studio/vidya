import type { RouteRecordRaw } from 'vue-router'

/** Routes for users. Owned by T2. */
export const routes: RouteRecordRaw[] = [
  {
    path: '/s/:schoolId/users',
    name: 'users',
    component: () => import('./ui/UsersPage.vue'),
    meta: { permission: 'users:read' },
  },
  {
    // The identifier is a prop rather than something read from the router, so
    // the screen mounts in a test and in a story without one.
    path: '/s/:schoolId/users/:id',
    name: 'user',
    props: true,
    component: () => import('./ui/UserCardPage.vue'),
    meta: {
      section: 'users',
      permission: 'users:read',
      nav: { parent: 'users', label: 'users-card-title' },
    },
  },
]
