import type { CourseId } from '@vidya/domain'
import type {
  CourseDetails,
  CourseSummary,
  GetCourseResponse,
  GetCoursesResponse,
} from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import type { HttpClient } from '@/ports'

const routes = Routes()

export const listCourses = async (http: HttpClient): Promise<CourseSummary[]> =>
  (await http.get<GetCoursesResponse>(routes.edu.courses.find())).items

export const getCourse = (http: HttpClient, id: CourseId): Promise<CourseDetails> =>
  http.get<GetCourseResponse>(routes.edu.courses.get(id))
