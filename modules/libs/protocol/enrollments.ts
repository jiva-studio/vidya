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

  /** The group the student asked for. A wish, not the school's placement. */
  preferredGroupId?: domain.GroupId

  /** When the student can attend, in their own time zone. */
  preferredTimes?: domain.PreferredTimes

  comment?: string

  /** Set when the student puts a finished request away; cleared by a new decision. */
  archivedByStudentAt?: domain.IsoDateTime

  /** The school's own side of the archiving. Read by the console, never sent to a device. */
  archivedBySchoolAt?: domain.IsoDateTime
  archivedBySchoolById?: domain.UserId
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

  /**
   * Narrows the answer to one school.
   *
   * The list is otherwise scoped only by the caller's grants, which can span
   * several. `scopedBySchool` intersects the two, so this cannot widen.
   */
  schoolId?: domain.SchoolId
}

/** The caller is the student, so naming one would only let them ask about someone else. */
export type GetMyEnrollmentsQuery = Omit<GetEnrollmentsQuery, 'studentId' | 'groupId' | 'schoolId'>

export type GetEnrollmentsResponse = crud.GetItemsListResponse<EnrollmentSummary>
export type GetEnrollmentResponse = crud.GetItemResponse<EnrollmentDetails>

/* -------------------------------------------------------------------------- */
/*                                 Moderation                                 */
/* -------------------------------------------------------------------------- */

/**
 * What the school decides about a place.
 *
 * `revoked` takes back a place already given, without ending the student's
 * membership of the school. `withdrawn` is absent: it is the student's to make.
 */
export type ModerateEnrollmentRequest = {
  status: Extract<domain.EnrollmentStatus, 'accepted' | 'declined' | 'revoked'>
  groupId?: domain.GroupId
}

export type ModerateEnrollmentResponse = crud.UpdateItemResponse<EnrollmentDetails>

/**
 * The school puts an answered row out of its own sight. No body: the tidying
 * carries no data, and who did it is read from the caller.
 */
export type ArchiveEnrollmentResponse = crud.UpdateItemResponse<EnrollmentDetails>

/** Move an already accepted student between groups, or out of the queue. */
export type AssignEnrollmentGroupRequest = { groupId: domain.GroupId | null }
export type AssignEnrollmentGroupResponse = crud.UpdateItemResponse<EnrollmentDetails>

export type DeleteEnrollmentResponse = crud.DeleteItemResponse
