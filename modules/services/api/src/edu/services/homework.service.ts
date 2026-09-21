import { ConflictException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { canTransitionHomework, HomeworkStatus } from '@vidya/domain'
import * as domain from '@vidya/domain'
import { Homework } from '@vidya/entities'
import { Repository } from 'typeorm'

import { Scope, ScopedEntitiesService } from './entities.service'
import { scopedBySchool } from './scoped-by-school'

/** What a reviewer decides. */
export type ReviewHomework = {
  status: Extract<HomeworkStatus, 'in_review' | 'returned' | 'accepted'>
  grade?: number
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
    if (!canTransitionHomework(work.status, request.status)) {
      throw new ConflictException(`Cannot move work from ${work.status} to ${request.status}`)
    }

    return this.updateOneBy(
      { id: work.id },
      {
        status: request.status,
        grade: request.status === 'accepted' ? request.grade : null,
        reviewedById: request.reviewerId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      },
    )
  }
}
