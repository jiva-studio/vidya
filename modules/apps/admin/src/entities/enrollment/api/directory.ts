import type { CourseId, SchoolId } from '@vidya/domain'
import type { GetCoursesResponse, GetGroupsResponse } from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import { useCurrentSchool } from '@/shared/access'
import type { HttpClient } from '@/shared/api'
import { useHttp } from '@/shared/api'

/**
 * The names behind the identifiers an enrolment carries.
 *
 * An enrolment names its course and its group by identifier only, so a list of
 * them is unreadable without these two requests. They are read here rather than
 * through `entities/course` and `entities/group` because those slices belong to
 * another track and are still empty; when they publish their own lists this
 * file goes away and the pages compose them instead.
 *
 * `GetGroupsQuery` takes a course and no school, and `GroupSummary` carries no
 * course: the whole list can be read at once to name a group, but choosing one
 * for a student has to ask for that course's groups, or the list would offer
 * groups from courses the student never applied to.
 */
export const directoryApi = (http: HttpClient) => ({
  courses: (schoolId: SchoolId | undefined) =>
    http.get<GetCoursesResponse>(Routes().edu.courses.find(), { schoolId }),

  groups: (courseId?: CourseId) =>
    http.get<GetGroupsResponse>(Routes().edu.groups.find(), { courseId }),
})

export type DirectoryApi = ReturnType<typeof directoryApi>

/** The same requests with the current school filled in at the moment of the call. */
export const useDirectoryApi = () => {
  const api = directoryApi(useHttp())
  const { schoolId } = useCurrentSchool()

  return { ...api, courses: () => api.courses(schoolId.value) }
}
