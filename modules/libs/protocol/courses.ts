import * as domain from '@vidya/domain'

import * as crud from './crud'

/* -------------------------------------------------------------------------- */
/*                                   Models                                   */
/* -------------------------------------------------------------------------- */

/** Only a published course appears in a school's catalogue; see {@link domain.CourseStatuses}. */
export type CourseDetails = {
  id: domain.CourseId
  schoolId: domain.SchoolId
  name: string
  description?: string
  learningType: domain.CourseLearningType
  status: domain.CourseStatus
}

export type CourseSummary = Pick<CourseDetails, 'id' | 'name' | 'description' | 'status'>

/* -------------------------------------------------------------------------- */
/*                                   Create                                   */
/* -------------------------------------------------------------------------- */

/** A new course starts as a draft; publishing it is a separate request. */
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
