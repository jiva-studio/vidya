import type { RouteRecordRaw } from 'vue-router'

/**
 * Routes for courses. Owned by T3.
 *
 * The form is one screen reached by two routes: creating and editing a course
 * differ by which request is sent, not by what is on screen.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/courses',
    name: 'courses',
    component: () => import('./ui/CoursesPage.vue'),
    meta: { permission: 'courses:read', breadcrumbs: ['nav-courses'] },
  },
  {
    path: '/courses/new',
    name: 'course-create',
    component: () => import('./ui/CourseFormPage.vue'),
    meta: {
      permission: 'courses:create',
      breadcrumbs: ['nav-courses', 'course-form-create-title'],
    },
  },
  {
    path: '/courses/:courseId/edit',
    name: 'course-edit',
    component: () => import('./ui/CourseFormPage.vue'),
    meta: {
      section: 'courses',
      permission: 'courses:update',
      breadcrumbs: ['nav-courses', 'course-form-edit-title'],
    },
  },
]
