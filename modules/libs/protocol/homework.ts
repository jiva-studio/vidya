import * as domain from '@vidya/domain'

import * as crud from './crud'
import { LessonBlockState } from './lessons'

/* -------------------------------------------------------------------------- */
/*                                   Models                                   */
/* -------------------------------------------------------------------------- */

export type HomeworkDetails = {
  id: domain.HomeworkId
  enrollmentId: domain.EnrollmentId

  /** The version answered, not the lesson: published versions are frozen. */
  lessonVersionId: domain.LessonVersionId

  sectionId: domain.SectionId
  schoolId: domain.SchoolId
  status: domain.HomeworkStatus
  text: string
  grade?: number
  reviewedById?: domain.UserId
  submittedAt?: domain.IsoDateTime
  reviewedAt?: domain.IsoDateTime

  /** Set when the answered version is no longer the published one: accepted, but flagged. */
  answeredSupersededVersion?: boolean

  /**
   * When the answer was first written, as the server recorded it.
   *
   * On the wire because the device orders a student's answers by it and has no
   * other way to learn it: an answer written on one phone is read on the next,
   * and a column filled with a fallback would sort that list wrongly and
   * silently. `enrollments` carries its `createdAt` for the same reason.
   */
  createdAt: domain.IsoDateTime
}

export type HomeworkSummary = Pick<
  HomeworkDetails,
  'id' | 'enrollmentId' | 'sectionId' | 'status' | 'grade' | 'submittedAt'
>

/* -------------------------------------------------------------------------- */
/*                                    Read                                    */
/* -------------------------------------------------------------------------- */

export type GetHomeworkQuery = crud.PageQuery & {
  enrollmentId?: domain.EnrollmentId
  groupId?: domain.GroupId
  status?: domain.HomeworkStatus

  /**
   * Narrows the answer to one school.
   *
   * The list is otherwise scoped only by the caller's grants, which can span
   * several. `scopedBySchool` intersects the two, so this cannot widen.
   */
  schoolId?: domain.SchoolId
}

export type GetHomeworkListResponse = crud.GetPagedItemsListResponse<HomeworkSummary>
export type GetHomeworkResponse = crud.GetItemResponse<HomeworkDetails>

/* -------------------------------------------------------------------------- */
/*                                   Review                                   */
/* -------------------------------------------------------------------------- */

/** Only a reviewer reaches these states; the client cannot set them itself. */
export type ReviewHomeworkRequest = {
  status: Extract<domain.HomeworkStatus, 'in_review' | 'returned' | 'accepted'>
  grade?: number
  comment?: string
}

export type ReviewHomeworkResponse = crud.UpdateItemResponse<HomeworkDetails>

/* -------------------------------------------------------------------------- */
/*                                  Progress                                  */
/* -------------------------------------------------------------------------- */

export type BlockStateDetails = {
  id: domain.BlockStateId
  enrollmentId: domain.EnrollmentId
  lessonVersionId: domain.LessonVersionId
  blockId: domain.BlockId
  schoolId: domain.SchoolId
  state: LessonBlockState
  updatedAt: domain.IsoDateTime
}
