import type { LocalHomework } from '@vidya/client'
import type { SectionId } from '@vidya/domain'

/**
 * The student's answer to each section of this lesson version, keyed by section.
 *
 * One section holds one answer — the device keys them that way — so a second
 * row against the same section is an answer written on another machine before
 * the two met, and the later one is the one the student is working on.
 */
export const toSectionAnswers = (
  answers: readonly LocalHomework[],
): Partial<Record<SectionId, LocalHomework>> => {
  const kept = new Map<SectionId, LocalHomework>()

  for (const answer of answers) {
    const held = kept.get(answer.sectionId)
    if (held === undefined || held.createdAt <= answer.createdAt) kept.set(answer.sectionId, answer)
  }

  return Object.fromEntries(kept)
}
