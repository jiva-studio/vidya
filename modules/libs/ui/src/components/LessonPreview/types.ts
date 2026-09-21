import type { LessonContent } from '@vidya/domain'

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

export interface LessonPreviewProps {
  content: LessonContent
  labels: LessonPreviewLabels
}
