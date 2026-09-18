import * as domain from '@vidya/domain'

import * as crud from './crud'

/* -------------------------------------------------------------------------- */
/*                                   Models                                   */
/* -------------------------------------------------------------------------- */

export type EnrollmentDetails = {
  id: domain.EnrollmentId
  courseId: domain.CourseId

  /** Empty until a group is assigned; an accepted student waits in the queue. */
  groupId?: domain.GroupId

  studentId: domain.UserId
  schoolId: domain.SchoolId
  status: domain.EnrollmentStatus
  decidedById?: domain.UserId
  decidedAt?: domain.IsoDateTime
  createdAt: domain.IsoDateTime
}

export type EnrollmentSummary = Pick<
  EnrollmentDetails,
  'id' | 'courseId' | 'groupId' | 'status' | 'createdAt'
>

/* -------------------------------------------------------------------------- */
/*                                   Enrol                                    */
/* -------------------------------------------------------------------------- */

/** A student asks to join a course. The school decides. */
export type CreateEnrollmentRequest = { courseId: string }
export type CreateEnrollmentResponse = crud.CreateItemResponse<EnrollmentDetails['id']>

/* -------------------------------------------------------------------------- */
/*                                    Read                                    */
/* -------------------------------------------------------------------------- */

export type GetEnrollmentsQuery = {
  courseId?: domain.CourseId
  groupId?: domain.GroupId
  studentId?: domain.UserId
  status?: domain.EnrollmentStatus
}

export type GetEnrollmentsResponse = crud.GetItemsListResponse<EnrollmentSummary>
export type GetEnrollmentResponse = crud.GetItemResponse<EnrollmentDetails>

/* -------------------------------------------------------------------------- */
/*                                 Moderation                                 */
/* -------------------------------------------------------------------------- */

/** Accept or decline a request, optionally placing the student in a group. */
export type ModerateEnrollmentRequest = {
  status: Extract<domain.EnrollmentStatus, 'accepted' | 'declined'>
  groupId?: domain.GroupId
}

export type ModerateEnrollmentResponse = crud.UpdateItemResponse<EnrollmentDetails>

/** Move an already accepted student between groups, or out of the queue. */
export type AssignEnrollmentGroupRequest = { groupId: domain.GroupId | null }
export type AssignEnrollmentGroupResponse = crud.UpdateItemResponse<EnrollmentDetails>

export type DeleteEnrollmentResponse = crud.DeleteItemResponse
