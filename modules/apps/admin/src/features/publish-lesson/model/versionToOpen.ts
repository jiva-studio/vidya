import type { LessonVersionSummary } from '@vidya/protocol'

import { HttpError } from '@/shared/api'

const newestFirst = (a: LessonVersionSummary, b: LessonVersionSummary): number =>
  b.version - a.version

const newest = (
  versions: readonly LessonVersionSummary[],
  status: LessonVersionSummary['status'],
): LessonVersionSummary | undefined =>
  [...versions].filter((version) => version.status === status).sort(newestFirst)[0]

export const openDraftOf = (
  versions: readonly LessonVersionSummary[],
): LessonVersionSummary | undefined => newest(versions, 'draft')

/**
 * Which version the editor opens when the operator arrives.
 *
 * The draft, if there is one — every lesson is born with a draft of version 1,
 * so the editor never creates a version on entry. Otherwise the newest
 * published one, which opens frozen. Nothing at all means the versions have not
 * been read, which is a load failure rather than an empty lesson.
 */
export const versionToOpen = (
  versions: readonly LessonVersionSummary[],
): LessonVersionSummary | undefined => openDraftOf(versions) ?? newest(versions, 'published')

/**
 * Whether a refusal means "a draft is already open".
 *
 * The server allows one draft per lesson, so asking for a second is a question
 * already answered rather than an error: the interface walks into the draft
 * that exists instead of printing a conflict at someone who wanted to write.
 */
export const isDraftConflict = (error: unknown): boolean =>
  error instanceof HttpError && error.status === 409
