import type { RouteRecordRaw } from 'vue-router'

/**
 * The front page: everything a student could join, from every school at once.
 *
 * It is the root because it is where a person lands after joining by a link,
 * and because no single school can name it.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'courses',
    component: () => import('./ui/CoursesPage.vue'),
  },
]
