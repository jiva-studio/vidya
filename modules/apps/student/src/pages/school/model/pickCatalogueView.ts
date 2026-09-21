/** Which of the five things a school's catalogue has to say. */
export type CatalogueView = 'reading' | 'arriving' | 'absent' | 'empty' | 'courses'

export interface CatalogueViewInput {
  /** Whether the answer from the local database is still being read. */
  readonly reading: boolean

  /** Whether a school of this code is on this machine at all. */
  readonly found: boolean

  /** Published courses this school has here. */
  readonly courses: number

  /** Whether a sync run has ever finished for this database. */
  readonly filled: boolean
}

/**
 * Tells three kinds of nothing apart.
 *
 * A database still being read, a school whose data has not arrived, and a
 * school that teaches nothing are one empty list and three different things to
 * do: wait a moment, wait for the run, or leave. A code that names no school
 * here is "not on this machine" rather than "no such school" — the code is
 * unique on the server, but the device holds only the schools this identity
 * has joined, and the answer to a stranger's code is silence, not a denial.
 */
export const pickCatalogueView = (input: CatalogueViewInput): CatalogueView => {
  if (input.reading) return 'reading'
  if (!input.found) return input.filled ? 'absent' : 'arriving'
  if (input.courses > 0) return 'courses'

  return input.filled ? 'empty' : 'arriving'
}
