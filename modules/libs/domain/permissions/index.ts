export const PermissionKeys = [
  // All permissions
  '*',

  // Roles
  'roles:create',
  'roles:read',
  'roles:update',
  'roles:delete',

  // Schools
  'schools:create',
  'schools:read',
  'schools:update',
  'schools:delete',

  // Users
  'users:read',
  'users:update',
  'users:delete',

  // Courses
  'courses:create',
  'courses:read',
  'courses:update',
  'courses:delete',

  // Lessons
  'lessons:create',
  'lessons:read',
  'lessons:update',
  'lessons:delete',
  // Publishing freezes a version students then work against, so it is granted
  // separately from ordinary editing.
  'lessons:publish',

  // Groups
  'groups:create',
  'groups:read',
  'groups:update',
  'groups:delete',

  // Enrollments
  'enrollments:read',
  // Accepting or declining a request, and moving a student between groups.
  'enrollments:moderate',

  // Homework
  'homework:read',
  'homework:grade',
] as const

export type PermissionKey = (typeof PermissionKeys)[number]

export const PermissionEnum = Object.freeze(
  PermissionKeys.reduce(
    (acc, key) => {
      acc[key] = key
      return acc
    },
    {} as Record<string, string>,
  ),
)
