export const Routes = (baseUrl: string = '') => ({
  auth: {
    root: () => `${baseUrl}/auth`,
    signIn: (method: string) => `${baseUrl}/auth/signin/${method}`,
    signOut: () => `${baseUrl}/auth/signout`,

    signup: (method: string) => `${baseUrl}/auth/signup/${method}`,
    tokens: {
      refresh: () => `${baseUrl}/auth/refresh`,
    },
    profile: () => `${baseUrl}/auth/profile`,
  },
  otp: {
    root: () => `${baseUrl}/auth/otp`,
  },
  /** Resolving a joining link. Public: the card is shown before anyone signs in. */
  join: {
    resolve: (code: string) => `${baseUrl}/j/${code}`,
  },
  sync: {
    pull: () => `${baseUrl}/sync/pull`,
    push: () => `${baseUrl}/sync/push`,
    cursor: () => `${baseUrl}/sync/cursor`,
  },
  media: {
    find: () => `${baseUrl}/media`,
    uploads: () => `${baseUrl}/media/uploads`,
    complete: (id: string) => `${baseUrl}/media/${id}/complete`,
    urls: () => `${baseUrl}/media/urls`,
    delete: (id: string) => `${baseUrl}/media/${id}`,
  },
  edu: {
    roles: {
      find: () => `${baseUrl}/edu/roles`,
      get: (id: string) => `${baseUrl}/edu/roles/${id}`,
      create: () => `${baseUrl}/edu/roles`,
      update: (id: string) => `${baseUrl}/edu/roles/${id}`,
      delete: (id: string) => `${baseUrl}/edu/roles/${id}`,
    },
    user: (userId?: string) => ({
      get: () => `${baseUrl}/edu/users/${userId}`,
      find: () => `${baseUrl}/edu/users`,
      update: () => `${baseUrl}/edu/users/${userId}`,
      delete: () => `${baseUrl}/edu/users/${userId}`,
      roles: {
        all: () => `${baseUrl}/edu/users/${userId}/roles`,
        create: () => `${baseUrl}/edu/users/${userId}/roles`,
        delete: (roleId: string) => `${baseUrl}/edu/users/${userId}/roles/${roleId}`,
      },
      schools: {
        all: () => `${baseUrl}/edu/users/${userId}/schools`,
        create: () => `${baseUrl}/edu/users/${userId}/schools`,
        delete: (schoolId: string) => `${baseUrl}/edu/users/${userId}/schools/${schoolId}`,
      },
    }),
    courses: {
      find: () => `${baseUrl}/edu/courses`,
      get: (id: string) => `${baseUrl}/edu/courses/${id}`,
      create: () => `${baseUrl}/edu/courses`,
      update: (id: string) => `${baseUrl}/edu/courses/${id}`,
      delete: (id: string) => `${baseUrl}/edu/courses/${id}`,
    },
    lessons: {
      find: () => `${baseUrl}/edu/lessons`,
      get: (id: string) => `${baseUrl}/edu/lessons/${id}`,
      create: () => `${baseUrl}/edu/lessons`,
      update: (id: string) => `${baseUrl}/edu/lessons/${id}`,
      delete: (id: string) => `${baseUrl}/edu/lessons/${id}`,
      versions: {
        all: (lessonId: string) => `${baseUrl}/edu/lessons/${lessonId}/versions`,
        get: (lessonId: string, versionId: string) =>
          `${baseUrl}/edu/lessons/${lessonId}/versions/${versionId}`,
        create: (lessonId: string) => `${baseUrl}/edu/lessons/${lessonId}/versions`,
        update: (lessonId: string, versionId: string) =>
          `${baseUrl}/edu/lessons/${lessonId}/versions/${versionId}`,
        publish: (lessonId: string, versionId: string) =>
          `${baseUrl}/edu/lessons/${lessonId}/versions/${versionId}/publish`,
      },
    },
    groups: {
      find: () => `${baseUrl}/edu/groups`,
      get: (id: string) => `${baseUrl}/edu/groups/${id}`,
      create: () => `${baseUrl}/edu/groups`,
      update: (id: string) => `${baseUrl}/edu/groups/${id}`,
      delete: (id: string) => `${baseUrl}/edu/groups/${id}`,
    },
    enrollments: {
      find: () => `${baseUrl}/edu/enrollments`,
      get: (id: string) => `${baseUrl}/edu/enrollments/${id}`,
      moderate: (id: string) => `${baseUrl}/edu/enrollments/${id}/moderation`,
      archive: (id: string) => `${baseUrl}/edu/enrollments/${id}/archive`,
      group: (id: string) => `${baseUrl}/edu/enrollments/${id}/group`,
      delete: (id: string) => `${baseUrl}/edu/enrollments/${id}`,
    },
    homework: {
      find: () => `${baseUrl}/edu/homework`,
      get: (id: string) => `${baseUrl}/edu/homework/${id}`,
      review: (id: string) => `${baseUrl}/edu/homework/${id}/review`,
    },
    schools: {
      storage: {
        get: (schoolId: string) => `${baseUrl}/edu/schools/${schoolId}/storage`,
        update: (schoolId: string) => `${baseUrl}/edu/schools/${schoolId}/storage`,
        delete: (schoolId: string) => `${baseUrl}/edu/schools/${schoolId}/storage`,
        verify: (schoolId: string) => `${baseUrl}/edu/schools/${schoolId}/storage/verify`,
        usage: (schoolId: string) => `${baseUrl}/edu/schools/${schoolId}/storage/usage`,
      },
      configs: {
        getAll: (schoolId: string) => `${baseUrl}/edu/schools/${schoolId}/configs`,
        update: (schoolId: string) => `${baseUrl}/edu/schools/${schoolId}/configs`,
      },
      code: (schoolId: string) => `${baseUrl}/edu/schools/${schoolId}/code`,
      find: () => `${baseUrl}/edu/schools`,
      get: (id: string) => `${baseUrl}/edu/schools/${id}`,
      create: () => `${baseUrl}/edu/schools`,
      update: (id: string) => `${baseUrl}/edu/schools/${id}`,
      delete: (id: string) => `${baseUrl}/edu/schools/${id}`,
    },
  },
})
