/** Which of the five things the front page has to say. */
export type CoursesView = 'reading' | 'arriving' | 'uninvited' | 'none' | 'courses'

export interface CoursesViewInput {
  /** Whether the answer is still being read. */
  readonly reading: boolean

  /** Schools this student belongs to. */
  readonly schools: number

  /** Courses those schools offer. */
  readonly courses: number

  /** Whether everything the school had to send has been asked for once. */
  readonly filled: boolean

  /** Whether a school was joined here and has not arrived yet. */
  readonly joined: boolean
}

/**
 * Tells three kinds of nothing apart.
 *
 * A student who was never invited, a student whose school is still answering,
 * and a school that offers no course are one empty list and three different
 * sentences. Saying the first to somebody who has just joined tells them their
 * school never let them in.
 */
export const pickCoursesView = (input: CoursesViewInput): CoursesView => {
  if (input.reading) return 'reading'
  if (input.courses > 0) return 'courses'
  if (!input.filled || input.joined) return 'arriving'

  return input.schools > 0 ? 'none' : 'uninvited'
}
