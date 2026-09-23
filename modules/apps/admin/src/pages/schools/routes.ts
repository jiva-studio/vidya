import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'

/**
 * Routes for schools. Owned by T2.
 *
 * The composition root reads this file by name, so filling it is the whole of
 * what a section has to do to appear in the application.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/s/:schoolId/schools',
    name: 'schools',
    component: () => import('./ui/SchoolsPage.vue'),
    meta: { permission: 'schools:create' },
  },
  {
    path: '/s/:schoolId/schools/new',
    name: 'school-new',
    component: () => import('./ui/SchoolFormPage.vue'),
    meta: {
      permission: 'schools:create',
      nav: { parent: 'schools', label: 'schools-form-create-title' },
    },
  },
  {
    path: '/s/:schoolId/schools/:id',
    name: 'school-edit',
    props: true,
    component: () => import('./ui/SchoolFormPage.vue'),
    meta: {
      section: 'schools',
      permission: 'schools:update',
      nav: { parent: 'schools', label: 'schools-form-edit-title' },
    },
  },
  {
    path: '/s/:schoolId/settings',
    name: 'school-settings',
    props: (route: RouteLocationNormalized) => ({ id: route.params.schoolId }),
    component: () => import('./ui/SchoolFormPage.vue'),
    meta: {
      section: 'school-settings',
      permission: 'schools:update',
    },
  },
]
