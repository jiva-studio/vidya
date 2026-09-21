import type { CourseLearningType, CourseStatus } from '@vidya/domain'

/**
 * What the course form holds and sends.
 *
 * Exactly the fields `CourseDetails` has. The archive's course carried a
 * subtitle and a cover image; neither exists in our schema, and a form field
 * that saves nowhere is worse than a missing one.
 */
export interface CourseFormValues {
  name: string
  description: string
  learningType: CourseLearningType
  status: CourseStatus
}
