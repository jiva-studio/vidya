import type { RouteRecordRaw } from 'vue-router'

/**
 * Signing in, which is also signing up: a code sent to an address creates the
 * account if there is none. There is no second form for that.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('./ui/LoginPage.vue'),
    meta: { public: true, chrome: false },
  },
]
