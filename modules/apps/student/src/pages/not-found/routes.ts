import type { RouteRecordRaw } from 'vue-router'

/** An address no section owns, including a school code that is not one. */
export const routes: RouteRecordRaw[] = [
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('./ui/NotFoundPage.vue'),
    meta: { public: true },
  },
]
