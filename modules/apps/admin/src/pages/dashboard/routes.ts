import type { RouteRecordRaw } from 'vue-router'

/**
 * The dashboard, and the root that leads to it.
 *
 * `/` names no school, so it cannot show one; the guard sends it to the first
 * school the token grants, which is also where sign-in lands.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'root',
    component: () => import('./ui/DashboardPage.vue'),
  },
  {
    path: '/s/:schoolId',
    name: 'dashboard',
    component: () => import('./ui/DashboardPage.vue'),
  },
]
