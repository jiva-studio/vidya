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
        delete: (roleId: string) => `${baseUrl}/edu/users/${userId}/schools/${roleId}`,
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
        published: (lessonId: string) => `${baseUrl}/edu/lessons/${lessonId}/versions/published`,
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
      my: () => `${baseUrl}/edu/enrollments/my`,
      get: (id: string) => `${baseUrl}/edu/enrollments/${id}`,
      create: () => `${baseUrl}/edu/enrollments`,
      moderate: (id: string) => `${baseUrl}/edu/enrollments/${id}/moderation`,
      group: (id: string) => `${baseUrl}/edu/enrollments/${id}/group`,
      delete: (id: string) => `${baseUrl}/edu/enrollments/${id}`,
    },
    homework: {
      find: () => `${baseUrl}/edu/homework`,
      get: (id: string) => `${baseUrl}/edu/homework/${id}`,
      submit: () => `${baseUrl}/edu/homework`,
      review: (id: string) => `${baseUrl}/edu/homework/${id}/review`,
    },
    progress: {
      find: () => `${baseUrl}/edu/progress`,
      save: () => `${baseUrl}/edu/progress`,
    },
    schools: {
      configs: {
        getAll: (schoolId: string) => `${baseUrl}/edu/schools/${schoolId}/configs`,
        update: (schoolId: string) => `${baseUrl}/edu/schools/${schoolId}/configs`,
      },
      find: () => `${baseUrl}/edu/schools`,
      get: (id: string) => `${baseUrl}/edu/schools/${id}`,
      create: () => `${baseUrl}/edu/schools`,
      update: (id: string) => `${baseUrl}/edu/schools/${id}`,
      delete: (id: string) => `${baseUrl}/edu/schools/${id}`,
    },
  },
})
