import type { LessonVersionSummary } from '@vidya/protocol'

import type { LessonVersionState } from '../types'

const newestFirst = (a: LessonVersionSummary, b: LessonVersionSummary): number =>
  b.version - a.version

const newest = (
  versions: readonly LessonVersionSummary[],
  status: LessonVersionSummary['status'],
): LessonVersionSummary | undefined =>
  [...versions].filter((version) => version.status === status).sort(newestFirst)[0]

/** The version students are working against right now, if the lesson has one. */
export const publishedVersionOf = (versions: readonly LessonVersionSummary[]): number | undefined =>
  newest(versions, 'published')?.version

/** The one open draft. The server refuses a second, so there is never a choice. */
export const draftVersionOf = (versions: readonly LessonVersionSummary[]): number | undefined =>
  newest(versions, 'draft')?.version

/**
 * What the badge on a lesson says.
 *
 * `undefined` rather than a guess when the lesson has no versions: every lesson
 * is created with a draft, so an empty list means the versions have not been
 * read, and a badge that claims "draft" would be inventing one.
 */
export const lessonVersionState = (
  versions: readonly LessonVersionSummary[],
): LessonVersionState | undefined => {
  const published = publishedVersionOf(versions)
  const draft = draftVersionOf(versions)

  if (published !== undefined && draft !== undefined) return 'revising'
  if (published !== undefined) return 'published'
  if (draft !== undefined) return 'draft'
  return undefined
}
