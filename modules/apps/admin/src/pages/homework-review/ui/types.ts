import type { HomeworkId, LessonId, LessonVersionId } from '@vidya/domain'
import type { HomeworkDetails } from '@vidya/protocol'

import type { ReviewWorkContext } from '../model'

/** The route hands the work over as a prop, so the screen mounts without a router. */
export interface HomeworkReviewPageProps {
  id: HomeworkId
}

export interface HomeworkWorkProps {
  work: HomeworkDetails
  context: ReviewWorkContext
}

export interface SupersededVersionNoticeProps {
  /** The version the student answered, which is no longer the published one. */
  lessonVersionId: LessonVersionId

  /** The lesson that version belongs to, once it has been resolved. */
  lessonId?: LessonId
}

export interface ReviewQueueNavProps {
  /** How many works still stand after this one. */
  remaining: number
}

export interface ReviewQueueNavEmits {
  next: []
}
