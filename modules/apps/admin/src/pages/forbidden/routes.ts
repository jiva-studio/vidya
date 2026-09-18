import type { RouteRecordRaw } from 'vue-router'

/**
 * Registered after every section, so a real screen is never shadowed by it.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/forbidden',
    name: 'forbidden',
    component: () => import('./ui/ForbiddenPage.vue'),
  },
]
