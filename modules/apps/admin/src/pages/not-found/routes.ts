import type { RouteRecordRaw } from 'vue-router'

/**
 * The catch-all, and therefore the last route in the table.
 *
 * Registering it any earlier would swallow every section added after it, and
 * the failure looks like a section that was never wired up at all.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('./ui/NotFoundPage.vue'),
    meta: { public: true },
  },
]
