import type { RouteRecordRaw } from 'vue-router'

/** Routes for roles. Owned by T2. */
export const routes: RouteRecordRaw[] = [
  {
    path: '/roles',
    name: 'roles',
    component: () => import('./ui/RolesPage.vue'),
    meta: { permission: 'roles:read', breadcrumbs: ['nav-roles'] },
  },
  {
    path: '/roles/new',
    name: 'role-new',
    component: () => import('./ui/RoleFormPage.vue'),
    meta: { permission: 'roles:create', breadcrumbs: ['nav-roles', 'roles-form-create-title'] },
  },
  {
    // The identifier is a prop rather than something read from the router, so
    // the screen mounts in a test and in a story without one.
    path: '/roles/:id',
    name: 'role-edit',
    props: true,
    component: () => import('./ui/RoleFormPage.vue'),
    meta: { permission: 'roles:update', breadcrumbs: ['nav-roles', 'roles-form-edit-title'] },
  },
]
