import * as domain from '@vidya/domain'

import * as crud from './crud'

/* -------------------------------------------------------------------------- */
/*                                   Content                                  */
/* -------------------------------------------------------------------------- */

export type {
  AudioBlock,
  AudioBlockState,
  LessonBlock,
  LessonBlockState,
  LessonContent,
  LessonSection,
  QuizBlock,
  QuizBlockState,
  TextBlock,
  TextBlockState,
  VideoBlock,
  VideoBlockState,
} from '@vidya/domain'
export type { BlockSource } from '@vidya/domain'
export { BlockSources } from '@vidya/domain'

/* -------------------------------------------------------------------------- */
/*                                   Models                                   */
/* -------------------------------------------------------------------------- */

export type LessonDetails = {
  id: domain.LessonId
  courseId: domain.CourseId
  lessonNumber: number
  title: string
}

export type LessonSummary = Pick<LessonDetails, 'id' | 'lessonNumber' | 'title'>

export type LessonVersionDetails = {
  id: domain.LessonVersionId
  lessonId: domain.LessonId
  version: number
  status: domain.LessonVersionStatus
  content: domain.LessonContent
  publishedAt?: domain.IsoDateTime
}

export type LessonVersionSummary = Omit<LessonVersionDetails, 'content'>

/* -------------------------------------------------------------------------- */
/*                             Student projection                             */
/* -------------------------------------------------------------------------- */

/**
 * A quiz as a student may receive it: the question and the options, never the
 * key. The server withholds `rightAnswer` and `explanation` on the way out,
 * because content is downloaded whole onto the device — once the key is in the
 * student's local database, no server-side fix can take it back.
 */
export type StudentQuizBlock = Omit<domain.QuizBlock, 'rightAnswer' | 'explanation'>

export type StudentLessonBlock =
  domain.TextBlock | domain.ImageBlock | domain.VideoBlock | domain.AudioBlock | StudentQuizBlock

export type StudentLessonSection = Omit<domain.LessonSection, 'blocks'> & {
  blocks: StudentLessonBlock[]
}

export type StudentLessonContent = Omit<domain.LessonContent, 'sections'> & {
  sections: StudentLessonSection[]
}

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
export type UpdateLessonVersionRequest = { content: domain.LessonContent }
export type UpdateLessonVersionResponse = crud.UpdateItemResponse<LessonVersionDetails>

export type PublishLessonVersionResponse = crud.UpdateItemResponse<LessonVersionSummary>

/* -------------------------------------------------------------------------- */
/*                                   Delete                                   */
/* -------------------------------------------------------------------------- */

export type DeleteLessonResponse = crud.DeleteItemResponse
