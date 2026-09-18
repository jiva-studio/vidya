import { BlockState, Course, Enrollment, Homework, Lesson, LessonVersion } from '@vidya/entities'

/**
 * The entities that reach devices.
 *
 * This list is the declaration; `projections.ts` is the implementation. They
 * are separate files on purpose: an entity added here without a projection has
 * no scope, no collection and no wire shape, and `` fails until one is
 * written. The alternative — one file that is its own authority — cannot
 * detect the case it exists to catch.
 *
 * Adding a row here is a decision that data leaves the server. Nothing else
 * syncs, and an entity absent from this list is absent from the journal.
 */
export const SYNCED_ENTITIES = [
  Course,
  Lesson,
  LessonVersion,
  Enrollment,
  Homework,
  BlockState,
] as const

export const SYNCED_ENTITY_NAMES: string[] = SYNCED_ENTITIES.map((entity) => entity.name)
