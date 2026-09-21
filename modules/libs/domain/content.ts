/**
 * The shape of lesson material.
 *
 * This lives in `domain` rather than `protocol` because it is not only a wire
 * shape: the database stores it verbatim in a JSON column, and the entity has to
 * name the same type or the column degenerates to `object` and every reader casts.
 * `protocol` re-exports it, so clients still import it from there.
 */

import { BlockId, SectionId } from './identity'

/**
 * Where a piece of media comes from, which decides what the client may do with
 * it. `upload` is ours and can be taken offline; everything else is embedded and
 * needs the network. v1 ships embeds only — the discriminator exists now so
 * adding downloads later changes no schema and no already-authored content.
 */
export const BlockSources = ['upload', 'youtube', 'vimeo', 'url'] as const
export type BlockSource = (typeof BlockSources)[number]

export type TextBlock = {
  id: BlockId
  type: 'text'
  content: string
}

export type ImageBlock = {
  id: BlockId
  type: 'image'
  source: BlockSource
  url: string
  caption?: string
}

export type VideoBlock = {
  id: BlockId
  type: 'video'
  source: BlockSource
  url: string
  posterUrl?: string
  caption?: string
}

export type AudioBlock = {
  id: BlockId
  type: 'audio'
  source: BlockSource
  url: string
  caption?: string
}

export type QuizBlock = {
  id: BlockId
  type: 'quiz'
  question: string
  answers: string[]
  rightAnswer: number

  /** Shown after answering, and withheld from the student's copy like the key itself. */
  explanation?: string
}

export type LessonBlock = TextBlock | ImageBlock | VideoBlock | AudioBlock | QuizBlock

/**
 * A section is the unit homework attaches to, so its id is a durable reference,
 * not a position. Ids are assigned when the block is created in the editor and
 * are never reused — an id handed out at render time, or an array index used as
 * identity, would orphan every submitted answer on the next edit.
 */
export type LessonSection = {
  id: SectionId
  title: string
  blocks: LessonBlock[]

  /** Whether this section asks for homework, and who marks it. */
  assessment: 'none' | 'auto' | 'teacher'
}

/**
 * The shape number of the document below. A published version is frozen and
 * stays readable for as long as the answers against it are worth keeping, so a
 * reader has to be told which rules produced the document rather than guess
 * them from the fields that happen to be present.
 */
export const LessonContentSchemaVersion = 1

export type LessonContent = {
  schemaVersion: number
  sections: LessonSection[]
}

export const emptyLessonContent = (): LessonContent => ({
  schemaVersion: LessonContentSchemaVersion,
  sections: [],
})

/* -------------------------------------------------------------------------- */
/*                                Block state                                 */
/* -------------------------------------------------------------------------- */

export type VideoBlockState = { type: 'video'; watched: number; duration: number }
export type AudioBlockState = { type: 'audio'; listened: number; duration: number }
export type QuizBlockState = { type: 'quiz'; answer: number }
export type TextBlockState = { type: 'text'; read: boolean }

export type LessonBlockState = VideoBlockState | AudioBlockState | QuizBlockState | TextBlockState

/**
 * What the server says about an answer, written once and never by the client.
 *
 * The explanation travels here and nowhere else: it is withheld from the
 * lesson a student downloads, because content reaches a device whole and a key
 * handed out there cannot be recalled. Returned with the verdict it is safe —
 * the answer is already spent, and one blocks worth of prose is not the key to
 * the rest.
 */
export type QuizVerdict = {
  correct: boolean
  explanation?: string
}
