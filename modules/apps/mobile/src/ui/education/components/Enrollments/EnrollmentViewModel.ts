import { Course, Enrollment, Group } from '@/ui/education'

export interface EnrollmentViewModel {
  enrollment: Enrollment,
  group?: Group,
  course: Course
}
