import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { EnrollmentStatus, LiveEnrollmentStatuses } from '@vidya/domain'
import * as domain from '@vidya/domain'
import { Course, Enrollment } from '@vidya/entities'
import { EntityManager, In, Repository } from 'typeorm'

import { Scope, ScopedEntitiesService } from './entities.service'
import { GroupsService } from './groups.service'
import { LessonsService } from './lessons.service'
import { LessonVersionsService } from './lessonVersions.service'
import { scopedBySchool } from './scoped-by-school'

export type ModerationStatus = Extract<EnrollmentStatus, 'accepted' | 'declined'>

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
 * were rather than made to apply again, which the unique index would refuse
 * anyway. There is no open request there to refuse, hence no way back to
 * `declined`.
 *
 * `declined` is empty and stays empty. A refusal on the merits is an answer,
 * not a pause; reversing it is a new request, not a second answer to the old.
 *
 * `withdrawn` is empty too: the student gave the place back, and the school
 * does not decide its way out of that.
 */
const MODERATION: Readonly<Record<EnrollmentStatus, readonly ModerationStatus[]>> = Object.freeze({
  pending: ['accepted', 'declined'],
  accepted: [],
  declined: [],
  revoked: ['accepted'],
  withdrawn: [],
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
    private readonly lessons: LessonsService,
    private readonly versions: LessonVersionsService,
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

  /**
   * The student's accepted place on the course a lesson version belongs to.
   *
   * Resolved from the caller and the content rather than taken from the
   * request: the chain is version -> lesson -> course -> enrolment, and every
   * link of it is what proves the student may be writing here at all. Both the
   * homework and the progress endpoints need it, which is why it is not a
   * private helper on either of them.
   */
  async forLessonVersion(
    lessonVersionId: domain.LessonVersionId,
    studentId: domain.UserId,
  ): Promise<Enrollment> {
    const version = await this.versions.findOneBy({ id: lessonVersionId })

    if (!version) {
      throw new NotFoundException(`Lesson version ${lessonVersionId} not found`)
    }

    const lesson = await this.lessons.findOneBy({ id: version.lessonId })

    if (!lesson) {
      throw new NotFoundException(`Lesson with id ${version.lessonId} not found`)
    }

    const enrollment = await this.findOneBy({
      studentId,
      courseId: lesson.courseId,
      status: 'accepted',
    })

    // Access comes from being enrolled; a pending or declined request is not a place.
    if (!enrollment) {
      throw new ForbiddenException('Not enrolled on the course this lesson belongs to')
    }

    return enrollment
  }

  /** Whether this enrolment is the caller's own. */
  isOwnedBy(enrollment: Enrollment | null, userId: domain.UserId): boolean {
    return enrollment?.studentId === userId
  }

  /**
   * A student asks to join. The school decides later.
   *
   * The check and the insert are two statements, so two requests arriving
   * together can both pass the check. The unique index is what actually decides
   * it; the check is only here to give the ordinary case a readable error rather
   * than a constraint name. Both paths end in the same 409.
   */
  async request(course: Course, studentId: domain.UserId): Promise<Enrollment> {
    const existing = await this.findOneBy({ courseId: course.id, studentId })

    if (existing) {
      throw new ConflictException('Already enrolled on this course')
    }

    try {
      return await this.create({
        courseId: course.id,
        studentId,
        schoolId: course.schoolId,
        status: 'pending',
      })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error

      throw new ConflictException('Already enrolled on this course')
    }
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
   * ended the membership commit or roll back together.
   */
  async revokePlacesIn(
    studentId: domain.UserId,
    schoolId: domain.SchoolId,
    manager: EntityManager,
  ): Promise<void> {
    const places = await manager.findBy(Enrollment, {
      studentId,
      schoolId,
      status: In([...LiveEnrollmentStatuses]),
    })

    for (const place of places) {
      place.status = 'revoked'
      await manager.save(place)
    }
  }

  /** Accept or decline a request, or give back a place the school took away. */
  async moderate(enrollment: Enrollment, decision: ModerationDecision): Promise<Enrollment> {
    if (!MODERATION[enrollment.status].includes(decision.status)) {
      throw new ConflictException(
        `Enrollment ${enrollment.id} cannot go from ${enrollment.status} to ${decision.status}`,
      )
    }

    if (decision.groupId) {
      await this.assertGroupBelongsToCourse(decision.groupId, enrollment.courseId)
    }

    return this.updateOneBy(
      { id: enrollment.id },
      {
        status: decision.status,
        groupId: decision.groupId ?? null,
        decidedById: decision.decidedById,
        decidedAt: new Date(),
      },
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
