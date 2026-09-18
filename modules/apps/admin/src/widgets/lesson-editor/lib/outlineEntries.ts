import type { LessonSection } from '@vidya/domain'

import { anchorOf } from './anchorOf'

export type OutlineEntry = { anchor: string; label: string }

/** The list at the top of the editor: numbered titles, in the order they read. */
export const outlineEntries = (
  sections: readonly LessonSection[],
  untitled: string,
): OutlineEntry[] =>
  sections.map((section, index) => ({
    anchor: anchorOf(section.id),
    label: `${index + 1}. ${section.title.trim() || untitled}`,
  }))
