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
}

export type CourseSummary = Pick<CourseDetails, 'id' | 'name' | 'description'>

/* -------------------------------------------------------------------------- */
/*                                   Create                                   */
/* -------------------------------------------------------------------------- */

export type CreateCourseRequest = crud.CreateItemRequest<Omit<CourseDetails, 'id'>>
export type CreateCourseResponse = crud.CreateItemResponse<CourseDetails['id']>

/* -------------------------------------------------------------------------- */
/*                                    Read                                    */
/* -------------------------------------------------------------------------- */

export type GetCoursesQuery = crud.PageQuery & {
  schoolId?: string
  query?: string
}

export type GetCoursesResponse = crud.GetPagedItemsListResponse<CourseSummary>
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
