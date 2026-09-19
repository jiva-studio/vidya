import type { LessonContent } from '@vidya/domain'
import { LessonContentSchemaVersion } from '@vidya/domain'

import type { ContentProblem } from '../types'
import { isKnownBlockType } from './blocks'

/**
 * What this build cannot author in a document it was handed.
 *
 * Saving strips whatever the editor did not model, and a stripped block is a
 * block a student answered against. So an unknown block type or a document
 * written by a newer build is reported and the save is refused, rather than the
 * content being quietly rewritten to whatever this version understood.
 */
export const contentProblems = (content: LessonContent): ContentProblem[] => {
  const problems: ContentProblem[] = []

  if (content.schemaVersion > LessonContentSchemaVersion) {
    problems.push({ kind: 'schema-version', detail: String(content.schemaVersion) })
  }

  for (const section of content.sections) {
    const unknown = section.blocks.filter((block) => !isKnownBlockType(block.type))
    for (const block of unknown) {
      problems.push({ kind: 'unknown-block', detail: block.type })
    }
  }

  return problems
}
