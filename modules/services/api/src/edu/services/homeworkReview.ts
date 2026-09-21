import { ConflictException } from '@nestjs/common'
import * as domain from '@vidya/domain'
import { Homework } from '@vidya/entities'
import { DeepPartial } from 'typeorm'

/**
 * What a reviewer decides about a piece of work.
 *
 * `reviewedById` is nullable because a section marked by machine reaches a
 * status with nobody behind it, and `at` is passed in rather than read from the
 * clock so the moment of a decision is the moment of the write that carries it.
 */
export interface HomeworkDecision {
  status: Extract<domain.HomeworkStatus, 'in_review' | 'returned' | 'accepted'>
  grade?: number
  comment?: string | null
  reviewedById: domain.UserId | null
  at: Date
}

/**
 * The single transition into a homework status, as the fields it writes.
 *
 * Both a reviewer and the automatic marking of a section arrive here, and
 * neither reaches the columns any other way: a second implementation would be a
 * second lifecycle, and the two would disagree on the first status either of
 * them gained.
 *
 * A grade belongs to accepted work alone, and the words of a decision belong to
 * the decision that was taken — so work sent back a second time does not carry
 * the reasons it was sent back the first.
 */
export const decideHomework = (
  work: Homework,
  decision: HomeworkDecision,
): DeepPartial<Homework> => {
  if (!domain.canTransitionHomework(work.status, decision.status)) {
    throw new ConflictException(`Cannot move work from ${work.status} to ${decision.status}`)
  }

  return {
    status: decision.status,
    grade: decision.status === 'accepted' ? decision.grade : null,
    comment: decision.comment ?? null,
    reviewedById: decision.reviewedById,
    reviewedAt: decision.at,
    updatedAt: decision.at,
  }
}
