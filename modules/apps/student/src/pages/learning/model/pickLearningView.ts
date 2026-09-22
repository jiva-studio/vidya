/** Which of the three things the learning screen has to say. */
export type LearningView = 'schools' | 'arriving' | 'uninvited'

export interface LearningViewInput {
  /** Schools this machine holds. */
  readonly schools: number

  /** Whether a sync run has ever finished for this database. */
  readonly filled: boolean

  /** Whether a school was joined in this tab and has not arrived yet. */
  readonly joined: boolean
}

/**
 * Tells the two empty screens apart.
 *
 * "Nobody has invited you anywhere" and "your courses have not arrived yet"
 * look the same from the database — no rows either way — and mean opposite
 * things to the student. The first is the end of the road for somebody who
 * signed in without a link; the second is thirty seconds of waiting. Saying
 * the first while a backfill is running tells a student their school is gone.
 */
export const pickLearningView = (input: LearningViewInput): LearningView => {
  if (input.schools > 0) return 'schools'
  if (!input.filled || input.joined) return 'arriving'

  return 'uninvited'
}
