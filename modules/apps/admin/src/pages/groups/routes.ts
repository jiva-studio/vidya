import type { RouteRecordRaw } from 'vue-router'

/**
 * Routes for groups. Owned by T3.
 *
 * The roster is its own screen rather than a tab of the form: who is in a
 * group is read far more often than the group's name is edited.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/s/:schoolId/groups',
    name: 'groups',
    component: () => import('./ui/GroupsPage.vue'),
    meta: { permission: 'groups:read', breadcrumbs: ['nav-groups'] },
  },
  {
    path: '/s/:schoolId/groups/new',
    name: 'group-create',
    component: () => import('./ui/GroupFormPage.vue'),
    meta: { permission: 'groups:create', breadcrumbs: ['nav-groups', 'group-form-create-title'] },
  },
  {
    path: '/s/:schoolId/groups/:groupId/edit',
    name: 'group-edit',
    component: () => import('./ui/GroupFormPage.vue'),
    meta: {
      section: 'groups',
      permission: 'groups:update',
      breadcrumbs: ['nav-groups', 'group-form-edit-title'],
    },
  },
  {
    path: '/s/:schoolId/groups/:groupId/members',
    name: 'group-members',
    component: () => import('./ui/GroupMembersPage.vue'),
    meta: {
      section: 'groups',
      permission: 'enrollments:read',
      breadcrumbs: ['nav-groups', 'group-members-title'],
    },
  },
]
