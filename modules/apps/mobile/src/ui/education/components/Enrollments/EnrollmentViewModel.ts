import type { CourseSummary, EnrollmentSummary, GroupSummary } from '@vidya/protocol'

export interface EnrollmentViewModel {
  enrollment: EnrollmentSummary
  group?: GroupSummary
  course: CourseSummary
}
