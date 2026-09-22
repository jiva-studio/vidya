import type { HomeworkStatus } from '@vidya/domain'
import type { BadgeTone } from '@vidya/ui'

/** How an answer's standing is said on a screen: a message key and its colour. */
export interface AnswerBadge {
  readonly key: string
  readonly tone: BadgeTone
}

/**
 * The five states an answer passes through, each said in its own words.
 *
 * `returned` and `accepted` are the two ends and must not share a word: one
 * asks the student to write again, the other says there is nothing left to do.
 * `open` is an answer begun and never handed in, which is the student's own
 * doing and not the school's.
 */
const BADGES: Record<HomeworkStatus, AnswerBadge> = {
  open: { key: 'answer-open', tone: 'neutral' },
  pending: { key: 'answer-pending', tone: 'warning' },
  in_review: { key: 'answer-in-review', tone: 'info' },
  returned: { key: 'answer-returned', tone: 'warning' },
  accepted: { key: 'answer-accepted', tone: 'success' },
}

export const describeAnswer = (status: HomeworkStatus): AnswerBadge => BADGES[status]
