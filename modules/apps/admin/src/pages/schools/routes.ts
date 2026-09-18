import type { RouteRecordRaw } from 'vue-router'

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
    meta: { permission: 'schools:read', breadcrumbs: ['nav-schools'] },
  },
  {
    path: '/s/:schoolId/schools/new',
    name: 'school-new',
    component: () => import('./ui/SchoolFormPage.vue'),
    meta: {
      permission: 'schools:create',
      breadcrumbs: ['nav-schools', 'schools-form-create-title'],
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
      breadcrumbs: ['nav-schools', 'schools-form-edit-title'],
    },
  },
  {
    // The identifier is a prop rather than something read from the router, so
    // the screen mounts in a test and in a story without one.
    path: '/s/:schoolId/schools/:id/settings',
    name: 'school-settings',
    props: true,
    component: () => import('./ui/SchoolSettingsPage.vue'),
    meta: {
      section: 'schools',
      permission: 'schools:update',
      breadcrumbs: ['nav-schools', 'schools-settings-title'],
    },
  },
]
