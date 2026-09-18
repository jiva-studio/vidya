import * as domain from '@vidya/domain'

import * as crud from './crud'

/* -------------------------------------------------------------------------- */
/*                                   Content                                  */
/* -------------------------------------------------------------------------- */

/**
 * Where a piece of media comes from, which decides what the client may do with
 * it. `upload` is ours and can be taken offline; everything else is embedded and
 * needs the network. v1 ships embeds only — the discriminator exists now so
 * adding downloads later changes no schema and no already-authored content.
 */
export const BlockSources = ['upload', 'youtube', 'vimeo', 'url'] as const
export type BlockSource = (typeof BlockSources)[number]

export type TextBlock = {
  id: string
  type: 'text'
  content: string
}

export type VideoBlock = {
  id: string
  type: 'video'
  source: BlockSource
  url: string
  posterUrl?: string
}

export type AudioBlock = {
  id: string
  type: 'audio'
  source: BlockSource
  url: string
}

export type QuizBlock = {
  id: string
  type: 'quiz'
  question: string
  answers: string[]
  rightAnswer: number
}

export type LessonBlock = TextBlock | VideoBlock | AudioBlock | QuizBlock

/**
 * A section is the unit homework attaches to, so its id is a durable reference,
 * not a position. Ids are assigned when the block is created in the editor and
 * are never reused — an id handed out at render time, or an array index used as
 * identity, would orphan every submitted answer on the next edit.
 */
export type LessonSection = {
  id: string
  title: string
  blocks: LessonBlock[]

  /** Whether this section asks for homework, and who marks it. */
  assessment: 'none' | 'auto' | 'teacher'
}

export type LessonContent = {
  sections: LessonSection[]
}

/* -------------------------------------------------------------------------- */
/*                                Block state                                 */
/* -------------------------------------------------------------------------- */

export type VideoBlockState = { type: 'video'; watched: number; duration: number }
export type AudioBlockState = { type: 'audio'; listened: number; duration: number }
export type QuizBlockState = { type: 'quiz'; answer: number }
export type TextBlockState = { type: 'text'; read: boolean }

export type LessonBlockState = VideoBlockState | AudioBlockState | QuizBlockState | TextBlockState

/* -------------------------------------------------------------------------- */
/*                                   Models                                   */
/* -------------------------------------------------------------------------- */

export type LessonDetails = {
  id: string
  courseId: string
  lessonNumber: number
  title: string
}

export type LessonSummary = Pick<LessonDetails, 'id' | 'lessonNumber' | 'title'>

export type LessonVersionDetails = {
  id: string
  lessonId: string
  version: number
  status: domain.LessonVersionStatus
  content: LessonContent
  publishedAt?: string
}

export type LessonVersionSummary = Omit<LessonVersionDetails, 'content'>

/* -------------------------------------------------------------------------- */
/*                                   Create                                   */
/* -------------------------------------------------------------------------- */

export type CreateLessonRequest = crud.CreateItemRequest<Omit<LessonDetails, 'id'>>
export type CreateLessonResponse = crud.CreateItemResponse<LessonDetails['id']>

/* -------------------------------------------------------------------------- */
/*                                    Read                                    */
/* -------------------------------------------------------------------------- */

export type GetLessonsQuery = { courseId?: string }
export type GetLessonsResponse = crud.GetItemsListResponse<LessonSummary>
export type GetLessonResponse = crud.GetItemResponse<LessonDetails>
export type GetLessonVersionsResponse = crud.GetItemsListResponse<LessonVersionSummary>
export type GetLessonVersionResponse = crud.GetItemResponse<LessonVersionDetails>

/* -------------------------------------------------------------------------- */
/*                                   Update                                   */
/* -------------------------------------------------------------------------- */

export type UpdateLessonRequest = crud.UpdateItemRequest<Omit<LessonDetails, 'id'>>
export type UpdateLessonResponse = crud.UpdateItemResponse<LessonDetails>

/** Editing a draft replaces its content wholesale; published versions are frozen. */
export type UpdateLessonVersionRequest = { content: LessonContent }
export type UpdateLessonVersionResponse = crud.UpdateItemResponse<LessonVersionDetails>

export type PublishLessonVersionResponse = crud.UpdateItemResponse<LessonVersionSummary>

/* -------------------------------------------------------------------------- */
/*                                   Delete                                   */
/* -------------------------------------------------------------------------- */

export type DeleteLessonResponse = crud.DeleteItemResponse
