import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { EnrollmentStatus, isLive, LiveEnrollmentStatuses } from '@vidya/domain'
import * as domain from '@vidya/domain'
import { Enrollment } from '@vidya/entities'
import { EntityManager, In, Repository } from 'typeorm'

import { Scope, ScopedEntitiesService } from './entities.service'
import { GroupsService } from './groups.service'
import { scopedBySchool } from './scoped-by-school'

export type ModerationStatus = Extract<EnrollmentStatus, 'accepted' | 'declined' | 'revoked'>

export type ModerationDecision = {
  status: ModerationStatus
  groupId?: domain.GroupId
  decidedById: domain.UserId
}

/**
 * What a school may decide about a place, keyed by the state it is leaving.
 *
 * `revoked` reopens, and only into `accepted`: the school took the place back,
 * so the school can hand it back — a student who paid late is put where they
 * were rather than made to start again with nothing they had. There is no open
 * request there to refuse, hence no way back to `declined`.
 *
 * `accepted` goes to `revoked` and nowhere else: a place given can be taken
 * back, but not turned into a refusal, there being no request left to refuse.
 * `revoked` reopens to `accepted`, so the pair is reversible.
 *
 * `declined` is empty and stays empty. A refusal on the merits is an answer,
 * not a pause; reversing it is a new request, not a second answer to the old.
 *
 * `withdrawn` reopens the same way, and only the school may do it: a student
 * who could walk back in alone never really left. Asking again is open to them
 * and writes a new row beside the old one.
 */
const MODERATION: Readonly<Record<EnrollmentStatus, readonly ModerationStatus[]>> = Object.freeze({
  pending: ['accepted', 'declined'],
  accepted: ['revoked'],
  declined: [],
  revoked: ['accepted'],
  withdrawn: ['accepted'],
})

/**
 * What every new decision takes off the row.
 *
 * The group goes because whoever stopped being accepted is off its roll. Both
 * stamps go because news about a place has to reach the list it was put away
 * from — the student's, so the explanation is there, and the school's, so the
 * row comes back where it is now being decided again.
 */
const CLEARED_BY_A_NEW_DECISION = Object.freeze({
  groupId: null,
  archivedByStudentAt: null,
  archivedBySchoolAt: null,
  archivedBySchoolById: null,
})

/** Postgres reports a broken UNIQUE constraint as SQLSTATE 23505. */
const isUniqueViolation = (error: unknown): boolean =>
  (error as { code?: string })?.code === '23505'

/**
 * A student's place on a course, and how a school decides who gets one.
 *
 * Enrolment is moderated and the group comes second: a student can be accepted
 * before any suitable group exists and waits in the queue until one does, which
 * is why `groupId` stays empty rather than the request being held back.
 */
@Injectable()
export class EnrollmentsService extends ScopedEntitiesService<Enrollment, Scope> {
  constructor(
    @InjectRepository(Enrollment) repository: Repository<Enrollment>,
    private readonly groups: GroupsService,
  ) {
    super(repository, scopedBySchool<Enrollment>('enrollments:read'))
  }

  async getOrFail(id: domain.EnrollmentId): Promise<Enrollment> {
    const enrollment = await this.findOneBy({ id })

    if (!enrollment) {
      throw new NotFoundException(`Enrollment with id ${id} not found`)
    }

    return enrollment
  }

  /** Whether this enrolment is the caller's own. */
  isOwnedBy(enrollment: Enrollment | null, userId: domain.UserId): boolean {
    return enrollment?.studentId === userId
  }

  /**
   * Takes back every place this student holds in the school, decided or still
   * asked for. A place is what belonging to the school bought, so it does not
   * outlive the belonging; a refusal stays refused, being nothing to take back.
   *
   * The rows are saved one at a time on purpose. The journal is written by an
   * entity subscriber, so a bulk `UPDATE` would move the table and reach no
   * device: the scope cursor would walk past a change that was never written
   * down. `manager` is the caller's transaction, so the places and whatever
   * ended the membership commit or roll back together, and the count they
   * answer with is what was actually taken back rather than what was there to
   * take before the transaction opened.
   */
  async revokePlacesIn(
    studentId: domain.UserId,
    schoolId: domain.SchoolId,
    manager: EntityManager,
  ): Promise<number> {
    const places = await manager.findBy(Enrollment, {
      studentId,
      schoolId,
      status: In([...LiveEnrollmentStatuses]),
    })

    for (const place of places) {
      manager.merge(Enrollment, place, {
        status: 'revoked',
        decidedAt: new Date(),
        ...CLEARED_BY_A_NEW_DECISION,
      })

      await manager.save(place)
    }

    return places.length
  }

  /**
   * Accept or decline a request, or give back a place the school took away.
   *
   * Giving a finished place back adds a row to the partial index over live
   * ones, so it collides with a request the student made in the meantime. The
   * check reads that case out loud; the unique violation behind it is the last
   * line, and it is caught here rather than left to surface as a 500.
   */
  async moderate(enrollment: Enrollment, decision: ModerationDecision): Promise<Enrollment> {
    if (!MODERATION[enrollment.status].includes(decision.status)) {
      throw new ConflictException(
        `Enrollment ${enrollment.id} cannot go from ${enrollment.status} to ${decision.status}`,
      )
    }

    // `CLEARED_BY_A_NEW_DECISION` nulls the column and the write below puts
    // the decision's own value back, so an ended place could keep a group.
    if (decision.groupId && decision.status !== 'accepted') {
      throw new ConflictException(`A ${decision.status} place is not put in a group`)
    }

    if (decision.groupId) {
      await this.assertGroupBelongsToCourse(decision.groupId, enrollment.courseId)
    }

    if (isLive(decision.status)) {
      await this.assertNoOtherLivePlace(enrollment)
    }

    try {
      return await this.updateOneBy(
        { id: enrollment.id },
        {
          status: decision.status,
          decidedById: decision.decidedById,
          decidedAt: new Date(),
          ...CLEARED_BY_A_NEW_DECISION,
          groupId: decision.groupId ?? null,
        },
      )
    } catch (error) {
      if (!isUniqueViolation(error)) throw error

      throw new ConflictException(
        `Student ${enrollment.studentId} already holds a live place on course ${enrollment.courseId}`,
      )
    }
  }

  /**
   * The school puts a finished row out of its own sight.
   *
   * Only a finished one: hiding a request nobody answered leaves the student
   * waiting on an answer that is never coming. The student's own stamp is not
   * touched — each side tidies its own list.
   */
  async archiveForSchool(enrollment: Enrollment, byUserId: domain.UserId): Promise<Enrollment> {
    if (isLive(enrollment.status)) {
      throw new ConflictException(
        `Enrollment ${enrollment.id} is still ${enrollment.status}; answer it before putting it away`,
      )
    }

    return this.updateOneBy(
      { id: enrollment.id },
      { archivedBySchoolAt: new Date(), archivedBySchoolById: byUserId },
    )
  }

  /** Moves an accepted student between groups, or out of the queue into one. */
  async assignGroup(enrollment: Enrollment, groupId: domain.GroupId | null): Promise<Enrollment> {
    if (enrollment.status !== 'accepted') {
      throw new ConflictException(`Enrollment ${enrollment.id} is not accepted`)
    }

    if (groupId) {
      await this.assertGroupBelongsToCourse(groupId, enrollment.courseId)
    }

    return this.updateOneBy({ id: enrollment.id }, { groupId })
  }

  /** The live place this student holds on the course, if they hold one. */
  private findLivePlace(
    courseId: domain.CourseId,
    studentId: domain.UserId,
  ): Promise<Enrollment | null> {
    return this.findOneBy({ courseId, studentId, status: In([...LiveEnrollmentStatuses]) })
  }

  private async assertNoOtherLivePlace(enrollment: Enrollment): Promise<void> {
    const live = await this.findLivePlace(enrollment.courseId, enrollment.studentId)

    if (live && live.id !== enrollment.id) {
      throw new ConflictException(
        `Student ${enrollment.studentId} already holds a live place on course ${enrollment.courseId}`,
      )
    }
  }

  /**
   * A group belongs to exactly one course. Placing a student in a group from a
   * different course would give them a place on a course they never applied to.
   */
  private async assertGroupBelongsToCourse(
    groupId: domain.GroupId,
    courseId: domain.CourseId,
  ): Promise<void> {
    const group = await this.groups.findOneBy({ id: groupId })

    if (!group) {
      throw new NotFoundException(`Group with id ${groupId} not found`)
    }

    if (group.courseId !== courseId) {
      throw new ConflictException(`Group ${groupId} does not belong to course ${courseId}`)
    }
  }
}
