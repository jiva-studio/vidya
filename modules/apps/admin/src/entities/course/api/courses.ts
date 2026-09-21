import type { CourseId, SchoolId } from '@vidya/domain'
import type {
  CreateCourseRequest,
  CreateCourseResponse,
  GetCourseResponse,
  GetCoursesQuery,
  GetCoursesResponse,
  UpdateCourseRequest,
  UpdateCourseResponse,
} from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import type { HttpClient } from '@/shared/api'

import type { CourseFormValues } from '../types'

/**
 * The course endpoints, as functions rather than a client.
 *
 * The school is an argument, never a capture: the caller reads it from
 * `useCurrentSchool()` at the moment it asks, so a list can never be built for
 * the school that was current when the composable was created.
 */
export const getCourses = (http: HttpClient, query: GetCoursesQuery): Promise<GetCoursesResponse> =>
  http.get<GetCoursesResponse>(Routes().edu.courses.find(), { schoolId: query.schoolId })

export const getCourse = (http: HttpClient, id: CourseId): Promise<GetCourseResponse> =>
  http.get<GetCourseResponse>(Routes().edu.courses.get(id))

export const createCourse = (
  http: HttpClient,
  schoolId: SchoolId,
  values: CourseFormValues,
): Promise<CreateCourseResponse> =>
  http.post<CreateCourseResponse>(Routes().edu.courses.create(), {
    schoolId,
    name: values.name,
    description: values.description,
    learningType: values.learningType,
  } satisfies CreateCourseRequest)

export const updateCourse = (
  http: HttpClient,
  id: CourseId,
  values: CourseFormValues,
): Promise<UpdateCourseResponse> =>
  http.patch<UpdateCourseResponse>(Routes().edu.courses.update(id), {
    name: values.name,
    description: values.description,
    learningType: values.learningType,
    status: values.status,
  } satisfies UpdateCourseRequest)
