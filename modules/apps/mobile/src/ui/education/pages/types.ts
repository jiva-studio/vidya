import type { CourseId, EnrollmentId, LessonId } from '@vidya/domain'

export interface CourseDetailsPageProps {
  id: CourseId
}

export interface EnrollPageProps {
  courseId: CourseId
}

export interface EnrollCompletedPageProps {
  id: CourseId
}

export interface LessonPageProps {
  enrollmentId: EnrollmentId
  lessonId: LessonId
}

export interface MyEnrollmentPageProps {
  enrollmentId: EnrollmentId
}
