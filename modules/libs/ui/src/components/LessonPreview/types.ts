import type { BlockId, LessonBlockState, LessonContent } from '@vidya/domain'

/**
 * Every word the renderer puts on screen that the lesson itself does not carry.
 *
 * The library holds no message bundle, so the wording arrives from whoever
 * draws the lesson, and with it the decision of what to say at all: the console
 * names the right answer of a quiz, and a screen that leaves `rightAnswer` out
 * marks nothing.
 */
export interface LessonPreviewLabels {
  untitledSection: string
  embeddedMedia: string
  missingMedia: string
  emptyQuestion: string
  rightAnswer?: string
  describeUnknownBlock: (type: string) => string
}

/** The wording of the controls a lesson carries only on a student's copy. */
export interface LessonProgressLabels {
  markRead: string
  answerRecorded: string
}

/**
 * What the student has done on this lesson, and what they may still do.
 *
 * `states` is keyed by block, because a block is what progress is recorded
 * against. `editable` is false where this tab may not write — another tab
 * holds the database — so the controls are shown in the state they are in
 * rather than taking an answer that would be dropped.
 */
export interface LessonProgress {
  readonly states: Readonly<Partial<Record<BlockId, LessonBlockState>>>
  readonly editable: boolean
  readonly labels: LessonProgressLabels
}

/**
 * The lesson to draw, and whose copy of it this is.
 *
 * `progress` is what tells the two apart: with it the lesson is the student's
 * — blocks carry the controls that record what was done on them — and without
 * it the lesson is the author's, drawn and never answered.
 */
export interface LessonPreviewProps {
  content: LessonContent
  labels: LessonPreviewLabels
  progress?: LessonProgress
}

export interface LessonPreviewEmits {
  change: [blockId: BlockId, state: LessonBlockState]
}
