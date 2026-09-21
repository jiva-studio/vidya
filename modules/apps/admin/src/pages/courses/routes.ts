import type { RouteRecordRaw } from 'vue-router'

/**
 * Routes for courses. Owned by T3.
 *
 * The form is one screen reached by two routes: creating and editing a course
 * differ by which request is sent, not by what is on screen.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/s/:schoolId/courses',
    name: 'courses',
    component: () => import('./ui/CoursesPage.vue'),
    meta: { permission: 'courses:read' },
  },
  {
    path: '/s/:schoolId/courses/new',
    name: 'course-create',
    component: () => import('./ui/CourseFormPage.vue'),
    meta: {
      permission: 'courses:create',
      nav: { parent: 'courses', label: 'course-form-create-title' },
    },
  },
  {
    path: '/s/:schoolId/courses/:courseId/edit',
    name: 'course-edit',
    component: () => import('./ui/CourseFormPage.vue'),
    meta: {
      section: 'courses',
      permission: 'courses:update',
      nav: { parent: 'courses', label: 'course-form-edit-title' },
    },
  },
]
