import type { RouteRecordRaw } from 'vue-router'

/** The person's own settings, and what the site can say about its own data. */
export const routes: RouteRecordRaw[] = [
  {
    path: '/settings',
    name: 'settings',
    component: () => import('./ui/SettingsPage.vue'),
  },
]
