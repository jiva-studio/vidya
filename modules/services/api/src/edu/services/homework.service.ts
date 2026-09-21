import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { HomeworkStatus } from '@vidya/domain'
import * as domain from '@vidya/domain'
import { Homework } from '@vidya/entities'
import { Repository } from 'typeorm'

import { Scope, ScopedEntitiesService } from './entities.service'
import { decideHomework } from './homeworkReview'
import { scopedBySchool } from './scoped-by-school'

/** What a reviewer decides. */
export type ReviewHomework = {
  status: Extract<HomeworkStatus, 'in_review' | 'returned' | 'accepted'>
  grade?: number
  comment?: string
  reviewerId: domain.UserId
}

/**
 * The homework lifecycle, as a reviewer moves it forward.
 *
 * Answers arrive on the sync path, which applies its own freeze; what is left
 * here is review, which no client may ask for.
 */
@Injectable()
export class HomeworkService extends ScopedEntitiesService<Homework, Scope> {
  constructor(@InjectRepository(Homework) repository: Repository<Homework>) {
    super(repository, scopedBySchool<Homework>('homework:read'))
  }

  /** Moves work forward through review, refusing transitions the lifecycle forbids. */
  async review(work: Homework, request: ReviewHomework): Promise<Homework> {
    return this.updateOneBy(
      { id: work.id },
      decideHomework(work, {
        status: request.status,
        grade: request.grade,
        comment: request.comment,
        reviewedById: request.reviewerId,
        at: new Date(),
      }),
    )
  }
}
