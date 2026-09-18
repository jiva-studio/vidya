import type { CourseId, LessonId } from '@vidya/domain'
import type {
  GetLessonVersionResponse,
  GetLessonVersionsResponse,
  GetLessonsResponse,
  LessonSummary,
  LessonVersionDetails,
} from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import type { HttpClient } from '@/ports'

const routes = Routes()

export const listLessonsOfCourse = async (
  http: HttpClient,
  courseId: CourseId,
): Promise<LessonSummary[]> =>
  (await http.get<GetLessonsResponse>(routes.edu.lessons.find(), { courseId })).items

/**
 * What a student reads: the frozen material, never a draft.
 *
 * It takes two calls because the API has no route for "the published version of
 * this lesson" — the list is the only way to learn the id, and it answers with
 * drafts too. Recorded as a deficit; when the route exists this collapses to one
 * request and nothing above it changes.
 */
export const getPublishedLessonVersion = async (
  http: HttpClient,
  lessonId: LessonId,
): Promise<LessonVersionDetails | undefined> => {
  const { items } = await http.get<GetLessonVersionsResponse>(
    routes.edu.lessons.versions.all(lessonId),
  )
  const published = items
    .filter((version) => version.status === 'published')
    .sort((left, right) => right.version - left.version)[0]

  if (!published) return undefined
  return http.get<GetLessonVersionResponse>(
    routes.edu.lessons.versions.get(lessonId, published.id),
  )
}
