import { LessonContent, StudentLessonContent } from '@vidya/protocol'

/** The fields of lesson content a student may never be handed. */
const WITHHELD_FROM_STUDENTS: readonly string[] = ['rightAnswer', 'explanation']

/**
 * Drops the withheld field wherever it appears in the document.
 *
 * The walk is structural rather than typed on purpose: content carrying a
 * `schemaVersion` this build has never seen is stored and served verbatim, so a
 * shape nobody here anticipated still has to come out without the answer key.
 */
const strip = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(strip)
  if (value === null || typeof value !== 'object') return value

  const out: Record<string, unknown> = {}

  for (const [key, nested] of Object.entries(value)) {
    if (!WITHHELD_FROM_STUDENTS.includes(key)) out[key] = strip(nested)
  }

  return out
}

/**
 * The student-facing projection of lesson content.
 *
 * It exists because content is downloaded onto the device whole: a quiz key
 * that reaches SQLite there cannot be recalled by any later server change.
 */
export const toStudentContent = (content: LessonContent): StudentLessonContent =>
  strip(content) as StudentLessonContent
