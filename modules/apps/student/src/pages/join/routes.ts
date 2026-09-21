import type { RouteRecordRaw } from 'vue-router'

/**
 * The printed link: a school's page, open to anyone who has the code.
 *
 * Public on purpose. It is drawn before there is a session and before there is
 * a local database, because the person following it has neither yet.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/j/:code',
    name: 'join',
    component: () => import('./ui/JoinPage.vue'),
    meta: { public: true, chrome: false },
  },
]
