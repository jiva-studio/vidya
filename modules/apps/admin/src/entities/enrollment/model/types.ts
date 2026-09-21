import type {
  CourseId,
  EnrollmentId,
  EnrollmentStatus,
  GroupId,
  IsoDateTime,
  PreferredTimes,
  UserId,
} from '@vidya/domain'
import type { EnrollmentSummary } from '@vidya/protocol'
import type { Ref } from 'vue'

/**
 * One line of the enrolments table.
 *
 * `EnrollmentSummary` carries no student and no decision: both are read from
 * `EnrollmentDetails` and from the user entity, and merged in here, so the
 * table has one shape rather than three lists to line up in a template.
 */
export type EnrollmentRow = EnrollmentSummary & {
  studentId?: UserId
  studentName?: string
  courseName?: string
  groupName?: string
  decidedByName?: string
  decidedAt?: string
  preferredGroupId?: GroupId
  preferredTimes?: PreferredTimes
  comment?: string
  archivedBySchoolAt?: IsoDateTime

  /** Accepted and still without a group: the student waits for one. */
  inQueue: boolean
}

/** What the controls above the table narrow the list by. */
export interface EnrollmentFilters {
  status?: EnrollmentStatus
  courseId?: CourseId
  groupId?: GroupId
}

/** Reads one person's name. Injected, so the entity never reaches into another. */
export type NameLookup = (id: UserId) => Promise<string | undefined>

/** The name cache a list hands to the row builder. */
export interface StudentNames {
  names: Ref<Map<UserId, string>>
  resolve: (ids: (UserId | undefined)[]) => Promise<void>
}

/**
 * The names of the school's courses and groups, as the list needs them.
 *
 * Passed in rather than read here: a course and a group are two other slices,
 * and an entity may not reach into its neighbour.
 */
export interface Directory {
  courseNames: Ref<Map<CourseId, string>>
  groupNames: Ref<Map<GroupId, string>>
  load: () => Promise<void>
}

/** The fields the list endpoint leaves out, once they have been read. */
export interface ResolvedEnrollment {
  studentId: UserId
  courseId: CourseId
  groupId?: GroupId
  decidedById?: UserId
  decidedAt?: string
  preferredGroupId?: GroupId
  preferredTimes?: PreferredTimes
  comment?: string
  archivedBySchoolAt?: IsoDateTime
}

export type EnrollmentDetailsById = Map<EnrollmentId, ResolvedEnrollment>
