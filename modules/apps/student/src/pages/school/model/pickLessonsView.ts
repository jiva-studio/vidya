/** Which of the three things the lesson list of a course has to say. */
export type LessonsView = 'arriving' | 'empty' | 'lessons'

export interface LessonsViewInput {
  readonly lessons: number
  readonly filled: boolean
}

/**
 * A course with no lessons on it is either new or not yet arrived.
 *
 * A course row and its lessons travel together but are written one after the
 * other, so a course can be readable for a moment with none of its lessons
 * here. Saying "this course has no lessons" in that moment is wrong, and it is
 * the sentence a student would use to decide the course is not worth asking
 * for.
 */
export const pickLessonsView = (input: LessonsViewInput): LessonsView => {
  if (input.lessons > 0) return 'lessons'

  return input.filled ? 'empty' : 'arriving'
}
