/** Which of the four things the screen of one request has to say. */
export type PlaceView = 'reading' | 'arriving' | 'absent' | 'place'

export interface PlaceViewInput {
  readonly reading: boolean

  /** Whether a request of this student's for this course is on this machine. */
  readonly found: boolean

  readonly filled: boolean
}

/**
 * Says whether the request is here, still coming, or was never made.
 *
 * "No request" and "the requests have not arrived yet" are the same empty
 * screen and different news: a machine that has never finished a run holds
 * nothing of anybody's, and telling a student they never asked would be a
 * statement about the school that this machine cannot make.
 */
export const pickPlaceView = (input: PlaceViewInput): PlaceView => {
  if (input.reading) return 'reading'
  if (input.found) return 'place'

  return input.filled ? 'absent' : 'arriving'
}
