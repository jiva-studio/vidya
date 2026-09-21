import type { RouteRecordRaw } from 'vue-router'

/**
 * Everything that belongs to one school, under that school's public code.
 *
 * The code rather than the identifier, so the address can be pasted into a
 * message and opened by whoever receives it; the guard refuses anything that
 * is not one.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/s/:code',
    name: 'school',
    component: () => import('./ui/SchoolPage.vue'),
  },
  {
    path: '/s/:code/c/:courseId',
    name: 'course',
    component: () => import('./ui/CoursePage.vue'),
  },
  {
    path: '/s/:code/c/:courseId/enroll',
    name: 'enroll',
    component: () => import('./ui/EnrollPage.vue'),
  },
  {
    path: '/s/:code/c/:courseId/place',
    name: 'place',
    component: () => import('./ui/PlacePage.vue'),
  },
  {
    path: '/s/:code/c/:courseId/l/:lessonId',
    name: 'lesson',
    component: () => import('./ui/LessonPage.vue'),
  },
]
