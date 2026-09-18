// Public API of the enrollment entity. Owned by T4.
//
// Requests live in `api/`, the view model in `model/`, small pieces of the
// entity's own interface in `ui/`. Nothing outside this slice reaches past
// this file.
export type { DirectoryApi, EnrollmentApi } from './api'
export { directoryApi, enrollmentApi, useDirectoryApi, useEnrollmentApi } from './api'
export type {
  EnrollmentDetailsById,
  EnrollmentFilters,
  EnrollmentRow,
  NameLookup,
  ResolvedEnrollment,
  RowSources,
  StudentNames,
} from './model'
export {
  toEnrollmentRows,
  useDirectory,
  useEnrollmentLookup,
  useEnrollments,
  useStudentNames,
} from './model'
export { enrollmentLabels, EnrollmentStatusBadge, enrollmentTones } from './ui'
