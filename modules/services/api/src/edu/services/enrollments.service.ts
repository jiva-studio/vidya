import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { EnrollmentStatus } from '@vidya/domain'
import { Course, Enrollment } from '@vidya/entities'
import { Repository } from 'typeorm'

import { Scope, ScopedEntitiesService } from './entities.service'
import { GroupsService } from './groups.service'
import { LessonsService } from './lessons.service'
import { LessonVersionsService } from './lessonVersions.service'
import { scopedBySchool } from './scoped-by-school'

export type ModerationDecision = {
  status: Extract<EnrollmentStatus, 'accepted' | 'declined'>
  groupId?: string
  decidedById: string
}

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

  async getOrFail(id: string): Promise<Enrollment> {
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
  async forLessonVersion(lessonVersionId: string, studentId: string): Promise<Enrollment> {
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

    // Access to course content comes from being enrolled, not from a
    // permission. A pending or declined request is not a place on the course.
    if (!enrollment) {
      throw new ForbiddenException('Not enrolled on the course this lesson belongs to')
    }

    return enrollment
  }

  /** Whether this enrolment is the caller's own. */
  isOwnedBy(enrollment: Enrollment | null, userId: string): boolean {
    return enrollment?.studentId === userId
  }

  /** A student asks to join. The school decides later. */
  async request(course: Course, studentId: string): Promise<Enrollment> {
    const existing = await this.findOneBy({ courseId: course.id, studentId })

    if (existing) {
      throw new ConflictException('Already enrolled on this course')
    }

    return this.create({
      courseId: course.id,
      studentId,
      schoolId: course.schoolId,
      status: 'pending',
    })
  }

  /** Accept or decline. A request is decided once. */
  async moderate(enrollment: Enrollment, decision: ModerationDecision): Promise<Enrollment> {
    if (enrollment.status !== 'pending') {
      throw new ConflictException(`Enrollment ${enrollment.id} has already been decided`)
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
  async assignGroup(enrollment: Enrollment, groupId: string | null): Promise<Enrollment> {
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
  private async assertGroupBelongsToCourse(groupId: string, courseId: string): Promise<void> {
    const group = await this.groups.findOneBy({ id: groupId })

    if (!group) {
      throw new NotFoundException(`Group with id ${groupId} not found`)
    }

    if (group.courseId !== courseId) {
      throw new ConflictException(`Group ${groupId} does not belong to course ${courseId}`)
    }
  }
}
