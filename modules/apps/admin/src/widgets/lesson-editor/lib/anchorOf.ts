import type { SectionId } from '@vidya/domain'

/** Where the outline at the top of the editor points: one anchor per section. */
export const anchorOf = (id: SectionId): string => `lesson-section-${id}`
