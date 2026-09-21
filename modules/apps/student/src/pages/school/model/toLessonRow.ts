import type { LocalBlockState, LocalLesson, LocalLessonVersion } from '@vidya/client'

import type { LessonRow } from '../types'

const blocksIn = (version: LocalLessonVersion): number =>
  version.content.sections.reduce((total, section) => total + section.blocks.length, 0)

/**
 * One lesson with what the student has already done on it.
 *
 * Counted against the version this machine holds, because that is the one the
 * student would open. A state written against an older version is still a
 * state, so the count is capped rather than allowed to exceed the blocks it is
 * counted against — a lesson reading "7 of 5" is a lesson nobody trusts.
 */
export const toLessonRow = (
  lesson: LocalLesson,
  version: LocalLessonVersion | null,
  states: readonly LocalBlockState[],
): LessonRow => {
  const blocks = version === null ? 0 : blocksIn(version)

  return {
    id: lesson.id,
    number: lesson.lessonNumber,
    title: lesson.title,
    blocks,
    done: Math.min(states.length, blocks),
    held: version !== null,
  }
}
