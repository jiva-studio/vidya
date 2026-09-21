import * as domain from '@vidya/domain'

import * as crud from './crud'

/* -------------------------------------------------------------------------- */
/*                                   Models                                   */
/* -------------------------------------------------------------------------- */

export type CourseDetails = {
  id: domain.CourseId
  schoolId: domain.SchoolId
  name: string
  description?: string
  learningType: domain.CourseLearningType

  /** Only a published course is drawn in the catalogue; see {@link domain.CourseStatuses}. */
  status: domain.CourseStatus
}

export type CourseSummary = Pick<CourseDetails, 'id' | 'name' | 'description'>

/* -------------------------------------------------------------------------- */
/*                                   Create                                   */
/* -------------------------------------------------------------------------- */

/** A course is created out of sight: publication is a separate, later decision. */
export type CreateCourseRequest = crud.CreateItemRequest<Omit<CourseDetails, 'id' | 'status'>>
export type CreateCourseResponse = crud.CreateItemResponse<CourseDetails['id']>

/* -------------------------------------------------------------------------- */
/*                                    Read                                    */
/* -------------------------------------------------------------------------- */

export type GetCoursesQuery = { schoolId?: string }
export type GetCoursesResponse = crud.GetItemsListResponse<CourseSummary>
export type GetCourseResponse = crud.GetItemResponse<CourseDetails>

/* -------------------------------------------------------------------------- */
/*                                   Update                                   */
/* -------------------------------------------------------------------------- */

export type UpdateCourseRequest = crud.UpdateItemRequest<Omit<CourseDetails, 'id' | 'schoolId'>>
export type UpdateCourseResponse = crud.UpdateItemResponse<CourseDetails>

/* -------------------------------------------------------------------------- */
/*                                   Delete                                   */
/* -------------------------------------------------------------------------- */

export type DeleteCourseResponse = crud.DeleteItemResponse
