// Public API of the enrollment entity. Owned by T4.
//
// Requests live in `api/`, the view model in `model/`, small pieces of the
// entity's own interface in `ui/`. Nothing outside this slice reaches past
// this file.
export type { EnrollmentApi } from './api'
export { enrollmentApi, useEnrollmentApi } from './api'
export type {
  Directory,
  EnrollmentDetailsById,
  EnrollmentFilters,
  EnrollmentRow,
  NameLookup,
  ResolvedEnrollment,
  RowSources,
  StudentNames,
} from './model'
export { toEnrollmentRows, useEnrollmentLookup, useEnrollments, useStudentNames } from './model'
export { enrollmentLabels, EnrollmentStatusBadge, enrollmentTones } from './ui'
