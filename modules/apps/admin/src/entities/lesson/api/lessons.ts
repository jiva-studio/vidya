import type { CourseId, LessonId } from '@vidya/domain'
import type {
  CreateLessonRequest,
  CreateLessonResponse,
  GetLessonResponse,
  GetLessonsQuery,
  GetLessonsResponse,
  GetLessonVersionsResponse,
} from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import type { HttpClient } from '@/shared/api'

/**
 * The lesson endpoints.
 *
 * Lessons carry their school through their course, so `GetLessonsQuery` takes
 * only a course and the school never appears here.
 */
export const getLessons = (http: HttpClient, query: GetLessonsQuery): Promise<GetLessonsResponse> =>
  http.get<GetLessonsResponse>(Routes().edu.lessons.find(), { courseId: query.courseId })

export const getLesson = (http: HttpClient, id: LessonId): Promise<GetLessonResponse> =>
  http.get<GetLessonResponse>(Routes().edu.lessons.get(id))

/**
 * Every version of one lesson.
 *
 * `LessonSummary` carries no version at all, so a list that shows the state of
 * the latest version has to ask once per lesson. See the track report.
 */
export const getLessonVersions = (
  http: HttpClient,
  lessonId: LessonId,
): Promise<GetLessonVersionsResponse> =>
  http.get<GetLessonVersionsResponse>(Routes().edu.lessons.versions.all(lessonId))

export const createLesson = (
  http: HttpClient,
  courseId: CourseId,
  lessonNumber: number,
  title: string,
): Promise<CreateLessonResponse> =>
  http.post<CreateLessonResponse>(Routes().edu.lessons.create(), {
    courseId,
    lessonNumber,
    title,
  } satisfies CreateLessonRequest)
