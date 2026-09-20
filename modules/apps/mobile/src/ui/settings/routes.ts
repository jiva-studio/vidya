import type { RouteRecordRaw } from 'vue-router'

// Settings has no screens of its own yet: the download queue it used to hold
// belonged to offline media, which v1 does not ship.
export const routes: Array<RouteRecordRaw> = []

/**
 * The settings tab, as a child of the shell that draws the tab bar.
 *
 * It is a child rather than a route of its own because the bar belongs to that
 * shell: a tab pointing outside it would leave the student on a screen with no
 * navigation. When the app grows a shell above education, this route and the
 * bar move up together.
 */
export const tabRoutes: Array<RouteRecordRaw> = [
  {
    name: 'settings',
    path: 'settings',
    component: () => import('./pages/SettingsPage.vue'),
  },
]
