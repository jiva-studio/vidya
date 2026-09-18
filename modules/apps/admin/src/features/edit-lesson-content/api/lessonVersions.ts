import type { LessonContent, LessonId, LessonVersionId } from '@vidya/domain'
import type {
  GetLessonVersionResponse,
  UpdateLessonVersionRequest,
  UpdateLessonVersionResponse,
} from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import type { HttpClient } from '@/shared/api'

/** The one version the editor has open, content and all. */
export const getLessonVersion = (
  http: HttpClient,
  lessonId: LessonId,
  versionId: LessonVersionId,
): Promise<GetLessonVersionResponse> =>
  http.get<GetLessonVersionResponse>(Routes().edu.lessons.versions.get(lessonId, versionId))

/**
 * Saves the draft in one request, carrying the whole document.
 *
 * The server replaces `content` wholesale, so a partial save is not a smaller
 * save — it is a document with the rest of the lesson deleted.
 */
export const saveLessonVersion = (
  http: HttpClient,
  lessonId: LessonId,
  versionId: LessonVersionId,
  content: LessonContent,
): Promise<UpdateLessonVersionResponse> =>
  http.patch<UpdateLessonVersionResponse>(
    Routes().edu.lessons.versions.update(lessonId, versionId),
    { content } satisfies UpdateLessonVersionRequest,
  )
