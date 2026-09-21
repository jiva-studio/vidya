import type { BlockId, LessonBlockState, LessonContent, QuizVerdict } from '@vidya/domain'

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

/**
 * The wording of the controls a lesson carries only on a student's copy.
 *
 * `answerCorrect` and `answerIncorrect` are the two things a marked answer can
 * be; the explanation beside them is the lesson's own words and is not named
 * here.
 */
export interface LessonProgressLabels {
  markRead: string
  answerRecorded: string
  answerCorrect: string
  answerIncorrect: string
}

/**
 * What the student has done on this lesson, and what they may still do.
 *
 * `states` and `verdicts` are keyed by block, because a block is what progress
 * is recorded against; a verdict is absent until the server has marked the
 * answer, which is why it is a map of its own rather than a field of the state
 * the student wrote. `editable` is false where this tab may not write — another
 * tab holds the database — so the controls are shown in the state they are in
 * rather than taking an answer that would be dropped.
 */
export interface LessonProgress {
  readonly states: Readonly<Partial<Record<BlockId, LessonBlockState>>>
  readonly verdicts: Readonly<Partial<Record<BlockId, QuizVerdict>>>
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
