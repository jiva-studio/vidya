/** Which of the four things a course screen has to say. */
export type CourseView = 'reading' | 'arriving' | 'absent' | 'course'

export interface CourseViewInput {
  readonly reading: boolean

  /** Whether this school's course of that id is on this machine. */
  readonly found: boolean

  readonly filled: boolean
}

/**
 * Says whether the course is here, coming, or not on this machine at all.
 *
 * The same distinction the catalogue makes, for one course instead of a list:
 * an address that was sent to someone who has not joined the school resolves
 * to nothing here, and telling them the course does not exist would be a
 * statement about the server that this machine cannot make.
 */
export const pickCourseView = (input: CourseViewInput): CourseView => {
  if (input.reading) return 'reading'
  if (input.found) return 'course'

  return input.filled ? 'absent' : 'arriving'
}
