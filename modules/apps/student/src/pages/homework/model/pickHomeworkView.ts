/** Which of the three things the homework list has to say. */
export type HomeworkView = 'reading' | 'arriving' | 'empty' | 'answers'

export interface HomeworkViewInput {
  readonly reading: boolean
  readonly answers: number

  /** Whether a run has ever finished here, so an empty list means empty. */
  readonly filled: boolean
}

/**
 * Says whether the answers are here, coming, or genuinely none.
 *
 * "You have written nothing" and "your work has not arrived yet" are different
 * sentences, and saying the first to somebody whose device is still filling
 * tells them their work is gone.
 */
export const pickHomeworkView = (input: HomeworkViewInput): HomeworkView => {
  if (input.reading) return 'reading'
  if (input.answers > 0) return 'answers'

  return input.filled ? 'empty' : 'arriving'
}
