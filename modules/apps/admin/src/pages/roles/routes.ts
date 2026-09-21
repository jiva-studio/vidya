import type { RouteRecordRaw } from 'vue-router'

/** Routes for roles. Owned by T2. */
export const routes: RouteRecordRaw[] = [
  {
    path: '/s/:schoolId/roles',
    name: 'roles',
    component: () => import('./ui/RolesPage.vue'),
    meta: { permission: 'roles:read' },
  },
  {
    path: '/s/:schoolId/roles/new',
    name: 'role-new',
    component: () => import('./ui/RoleFormPage.vue'),
    meta: {
      permission: 'roles:create',
      nav: { parent: 'roles', label: 'roles-form-create-title' },
    },
  },
  {
    // The identifier is a prop rather than something read from the router, so
    // the screen mounts in a test and in a story without one.
    path: '/s/:schoolId/roles/:id',
    name: 'role-edit',
    props: true,
    component: () => import('./ui/RoleFormPage.vue'),
    meta: {
      section: 'roles',
      permission: 'roles:update',
      nav: { parent: 'roles', label: 'roles-form-edit-title' },
    },
  },
]
