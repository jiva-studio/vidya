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
}

export type HomeworkSummary = Pick<
  HomeworkDetails,
  'id' | 'enrollmentId' | 'sectionId' | 'status' | 'grade' | 'submittedAt'
>

/* -------------------------------------------------------------------------- */
/*                                   Submit                                   */
/* -------------------------------------------------------------------------- */

/**
 * The only transition a student can ask for. Submitting freezes the answer:
 * the text cannot be edited again until the work is returned for revision.
 */
export type SubmitHomeworkRequest = {
  lessonVersionId: domain.LessonVersionId
  sectionId: domain.SectionId
  text: string
}

export type SubmitHomeworkResponse = crud.UpdateItemResponse<HomeworkDetails>

/* -------------------------------------------------------------------------- */
/*                                    Read                                    */
/* -------------------------------------------------------------------------- */

export type GetHomeworkQuery = {
  enrollmentId?: domain.EnrollmentId
  groupId?: domain.GroupId
  status?: domain.HomeworkStatus
}

export type GetHomeworkListResponse = crud.GetItemsListResponse<HomeworkSummary>
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

export type SaveBlockStateRequest = {
  lessonVersionId: domain.LessonVersionId
  blockId: domain.BlockId
  state: LessonBlockState
}

export type SaveBlockStateResponse = crud.UpdateItemResponse<BlockStateDetails>
/** Without an enrolment the caller asks for their own, across every enrolment they hold. */
export type GetBlockStatesQuery = { enrollmentId?: string; lessonVersionId?: string }
export type GetBlockStatesResponse = crud.GetItemsListResponse<BlockStateDetails>
