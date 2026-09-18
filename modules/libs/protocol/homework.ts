import * as domain from '@vidya/domain'

import * as crud from './crud'
import { LessonBlockState } from './lessons'

/* -------------------------------------------------------------------------- */
/*                                   Models                                   */
/* -------------------------------------------------------------------------- */

export type HomeworkDetails = {
  id: string
  enrollmentId: string

  /** The version answered, not the lesson: published versions are frozen. */
  lessonVersionId: string

  sectionId: string
  schoolId: string
  status: domain.HomeworkStatus
  text: string
  grade?: number
  reviewedById?: string
  submittedAt?: string
  reviewedAt?: string

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
  lessonVersionId: string
  sectionId: string
  text: string
}

export type SubmitHomeworkResponse = crud.UpdateItemResponse<HomeworkDetails>

/* -------------------------------------------------------------------------- */
/*                                    Read                                    */
/* -------------------------------------------------------------------------- */

export type GetHomeworkQuery = {
  enrollmentId?: string
  groupId?: string
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
  id: string
  enrollmentId: string
  lessonVersionId: string
  blockId: string
  schoolId: string
  state: LessonBlockState
  updatedAt: string
}

export type SaveBlockStateRequest = {
  lessonVersionId: string
  blockId: string
  state: LessonBlockState
}

export type SaveBlockStateResponse = crud.UpdateItemResponse<BlockStateDetails>
export type GetBlockStatesQuery = { enrollmentId: string; lessonVersionId?: string }
export type GetBlockStatesResponse = crud.GetItemsListResponse<BlockStateDetails>
