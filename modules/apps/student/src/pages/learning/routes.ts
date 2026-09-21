import type { RouteRecordRaw } from 'vue-router'

/**
 * What belongs to the person rather than to one school: the courses of every
 * school they study in, in one list. It is the root because it is where a
 * student starts, and because no school can name it.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'learning',
    component: () => import('./ui/LearningPage.vue'),
  },
]
