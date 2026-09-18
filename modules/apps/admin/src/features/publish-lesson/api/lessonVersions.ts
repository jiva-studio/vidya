import type { LessonId, LessonVersionId } from '@vidya/domain'
import type { LessonVersionSummary, PublishLessonVersionResponse } from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import type { HttpClient } from '@/shared/api'

/**
 * Opens a revision of a lesson that is already live.
 *
 * The server copies the last published content into the new draft, so the
 * editor never has to reconstruct it, and refuses with 409 when a draft is
 * already open — which is an answer, not a failure. See `isDraftConflict`.
 */
export const openLessonRevision = (
  http: HttpClient,
  lessonId: LessonId,
): Promise<LessonVersionSummary> =>
  http.post<LessonVersionSummary>(Routes().edu.lessons.versions.create(lessonId))

/** Freezes the draft. From here it is what submitted homework points at. */
export const publishLessonVersion = (
  http: HttpClient,
  lessonId: LessonId,
  versionId: LessonVersionId,
): Promise<PublishLessonVersionResponse> =>
  http.post<PublishLessonVersionResponse>(
    Routes().edu.lessons.versions.publish(lessonId, versionId),
  )
