import type { RouteRecordRaw } from 'vue-router'

/**
 * The courses this student holds a place on, from every school in one list.
 *
 * It belongs to the person rather than to one school, so no school names it
 * and the address carries no code.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/learning',
    name: 'learning',
    component: () => import('./ui/LearningPage.vue'),
  },
]
