import type { BlockSource, LessonBlock, LessonContent } from '@vidya/domain'

/** The block kinds this build knows how to author and render. */
export const BlockTypes = ['text', 'image', 'video', 'audio', 'quiz'] as const
export type BlockType = (typeof BlockTypes)[number]

/** Sources an operator may pick today. `upload` is absent: there is no storage yet. */
export const AuthorableSources: readonly BlockSource[] = ['url', 'youtube', 'vimeo']

/**
 * Something in the stored content this build cannot author.
 *
 * Both kinds block saving: writing the document back would drop what we failed
 * to understand, and the dropped part is what a student already answered.
 */
export type ContentProblem =
  { kind: 'schema-version'; detail: string } | { kind: 'unknown-block'; detail: string }

/** A change to the whole document, expressed as a replacement rather than a mutation. */
export type ContentEdit = (content: LessonContent) => LessonContent

/** Which way a reordering button moves the thing it is attached to. */
export type MoveDirection = -1 | 1

export type BlockOf<TType extends BlockType> = Extract<LessonBlock, { type: TType }>
