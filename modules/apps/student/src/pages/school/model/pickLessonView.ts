import { LessonContentSchemaVersion } from '@vidya/domain'

/** Which of the five things a lesson screen has to say. */
export type LessonView = 'reading' | 'arriving' | 'absent' | 'outdated' | 'lesson'

export interface LessonViewInput {
  readonly reading: boolean

  /** Whether the lesson and a published version of it are on this machine. */
  readonly held: boolean

  readonly filled: boolean

  /** The shape number the stored lesson was written to. */
  readonly schemaVersion: number
}

/**
 * Says whether the lesson is here, coming, absent, or written to a shape this
 * build cannot read.
 *
 * A tab lives for days while the shape number grows, and a lesson of an
 * unknown shape is kept whole rather than drawn in part: half a lesson is
 * indistinguishable from a lesson that says less, and a student would answer
 * it. The shape is only asked about once there is a lesson to ask about,
 * because an absent one carries no number.
 */
export const pickLessonView = (input: LessonViewInput): LessonView => {
  if (input.reading) return 'reading'
  if (!input.held) return input.filled ? 'absent' : 'arriving'

  return input.schemaVersion > LessonContentSchemaVersion ? 'outdated' : 'lesson'
}
