import { ConflictException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { canTransitionHomework, HomeworkStatus } from '@vidya/domain'
import { Enrollment, Homework, LessonVersion } from '@vidya/entities'
import { Repository } from 'typeorm'

import { Scope, ScopedEntitiesService } from './entities.service'
import { LessonVersionsService } from './lessonVersions.service'
import { scopedBySchool } from './scoped-by-school'

/** What the caller supplies when a student hands work in. */
export type SubmitHomework = {
  enrollment: Enrollment
  version: LessonVersion
  sectionId: string
  text: string
}

/** What a reviewer decides. */
export type ReviewHomework = {
  status: Extract<HomeworkStatus, 'in_review' | 'returned' | 'accepted'>
  grade?: number
  reviewerId: string
}

/**
 * The homework lifecycle.
 *
 * Two rules keep the client and the server from ever writing the same field,
 * which is what makes offline submission safe without merge logic:
 *
 * - the client may only ever ask for `pending`, by submitting
 * - submitting freezes the answer until the work is returned for revision
 *
 * They live here, not in the controller, because the offline sync endpoints
 * will hand work in through a different door and must land on the same rules.
 */
@Injectable()
export class HomeworkService extends ScopedEntitiesService<Homework, Scope> {
  constructor(
    @InjectRepository(Homework) repository: Repository<Homework>,
    private readonly versions: LessonVersionsService,
  ) {
    super(repository, scopedBySchool<Homework>('homework:read'))
  }

  /**
   * Records an answer.
   *
   * Work answered against a superseded version is accepted and flagged rather
   * than rejected: a revision published while the device was offline is not the
   * student's fault, and the reviewer can open the version actually answered.
   */
  async submit(request: SubmitHomework): Promise<Homework> {
    const { enrollment, version, sectionId, text } = request

    const existing = await this.findOneBy({
      enrollmentId: enrollment.id,
      lessonVersionId: version.id,
      sectionId,
    })

    if (existing && !['open', 'returned'].includes(existing.status)) {
      throw new ConflictException(
        existing.status === 'accepted'
          ? 'This work has already been accepted'
          : `Work is ${existing.status} and cannot be edited`,
      )
    }

    const fields = {
      enrollmentId: enrollment.id,
      lessonVersionId: version.id,
      sectionId,
      schoolId: enrollment.schoolId,
      status: 'pending' as const,
      text,
      answeredSupersededVersion: await this.versions.isSuperseded(version),
      submittedAt: new Date(),
      updatedAt: new Date(),
    }

    return existing ? this.updateOneBy({ id: existing.id }, fields) : this.create(fields)
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

  /**
   * Every piece of work belonging to a student.
   *
   * Takes the enrollments rather than a student id so the caller has already
   * resolved what the student may see. An empty list means no work at all — it
   * must never widen to everything, which is what an OR over an empty array
   * does in TypeORM.
   */
  async forEnrollments(enrollments: Enrollment[], status?: HomeworkStatus): Promise<Homework[]> {
    if (enrollments.length === 0) return []

    return this.findAll({ where: enrollments.map((e) => ({ enrollmentId: e.id, status })) })
  }
}
