import type { CourseId, EnrollmentId, GroupId } from '@vidya/domain'
import type { GroupSummary } from '@vidya/protocol'

import type { EnrollmentRow } from '@/entities/enrollment'

/** What the row knows when it decides whether it may place the student. */
export interface PlacementRequest {
  courseId: CourseId
  preferredGroupId?: GroupId
  groups: Map<GroupId, GroupSummary>
  groupsUnreadable?: boolean
}

/** `place` without a group is the queue: accepted and unplaced, which is fine. */
export type Placement = { kind: 'place'; groupId?: GroupId } | { kind: 'review' }

export interface ModerationActionsProps {
  enrollment: EnrollmentRow

  /** Without `enrollments:moderate` the actions are absent, not disabled. */
  canModerate?: boolean

  busy?: boolean
}

export interface ModerationActionsEmits {
  accept: [id: EnrollmentId]
  decline: [id: EnrollmentId]
  revoke: [id: EnrollmentId]
  'assign-group': [id: EnrollmentId]
  review: [id: EnrollmentId]
}
