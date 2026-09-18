import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('./ui/LoginPage.vue'),
    meta: { public: true, chrome: false },
  },
]
