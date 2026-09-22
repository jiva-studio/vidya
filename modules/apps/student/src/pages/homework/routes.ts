import type { RouteRecordRaw } from 'vue-router'

/** Every school's homework in one list: it belongs to the person, not a school. */
export const routes: RouteRecordRaw[] = [
  {
    path: '/homework',
    name: 'homework',
    component: () => import('./ui/HomeworkPage.vue'),
  },
]
