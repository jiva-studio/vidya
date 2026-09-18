import { Mapper } from '@automapper/core'
import { InjectMapper } from '@automapper/nestjs'
import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Authentication } from '@vidya/api/auth/decorators'
import { AuthenticatedUserGuard } from '@vidya/api/auth/guards'
import { UserAuthentication } from '@vidya/api/auth/utils'
import * as dto from '@vidya/api/edu/dto'
import {
  EnrollmentsService,
  HomeworkService,
  LessonsService,
  LessonVersionsService,
} from '@vidya/api/edu/services'
import { CrudDecorators } from '@vidya/api/shared/decorators'
import { canTransitionHomework } from '@vidya/domain'
import * as entities from '@vidya/entities'
import { Routes } from '@vidya/protocol'

const Crud = CrudDecorators({
  entityName: 'Homework',
  getOneResponseDto: dto.GetHomeworkResponse,
  getManyResponseDto: dto.GetHomeworkListResponse,
  createOneResponseDto: dto.SubmitHomeworkResponse,
  updateOneResponseDto: dto.ReviewHomeworkResponse,
  deleteOneResponseDto: dto.GetHomeworkResponse,
})

@Controller()
@ApiTags('🎓 Education :: Homework')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
export class HomeworkController {
  constructor(
    private readonly homework: HomeworkService,
    private readonly enrollments: EnrollmentsService,
    private readonly versions: LessonVersionsService,
    private readonly lessons: LessonsService,
    @InjectMapper() private readonly mapper: Mapper,
  ) {}

  /* -------------------------------------------------------------------------- */
  /*                             POST /edu/homework                             */
  /* -------------------------------------------------------------------------- */

  /**
   * A student submits an answer. This is the only transition a client can ask
   * for; every state after it belongs to the reviewer.
   */
  @Crud.CreateOne(Routes().edu.homework.submit())
  async submit(
    @Body() request: dto.SubmitHomeworkRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.SubmitHomeworkResponse> {
    const version = await this.versions.findOneBy({ id: request.lessonVersionId })

    if (!version) {
      throw new NotFoundException(`Lesson version ${request.lessonVersionId} not found`)
    }

    const enrollment = await this.enrollmentForLessonVersion(version.lessonId, auth.userId)

    const existing = await this.homework.findOneBy({
      enrollmentId: enrollment.id,
      lessonVersionId: request.lessonVersionId,
      sectionId: request.sectionId,
    })

    // Submitting freezes the answer. The student edits again only after the work
    // comes back for revision.
    if (existing && !['open', 'returned'].includes(existing.status)) {
      throw new ConflictException(
        existing.status === 'accepted'
          ? 'This work has already been accepted'
          : `Work is ${existing.status} and cannot be edited`,
      )
    }

    const fields = {
      enrollmentId: enrollment.id,
      lessonVersionId: request.lessonVersionId,
      sectionId: request.sectionId,
      schoolId: enrollment.schoolId,
      status: 'pending' as const,
      text: request.text,
      submittedAt: new Date(),
      updatedAt: new Date(),
    }

    const saved = existing
      ? await this.homework.updateOneBy({ id: existing.id }, fields)
      : await this.homework.create(fields)

    return this.mapper.map(saved, entities.Homework, dto.SubmitHomeworkResponse)
  }

  /* -------------------------------------------------------------------------- */
  /*                              GET /edu/homework                             */
  /* -------------------------------------------------------------------------- */

  @Crud.GetMany(Routes().edu.homework.find())
  async getMany(
    @Query() query: dto.GetHomeworkQuery,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetHomeworkListResponse> {
    if (auth.permissions.has(['homework:read'])) {
      const found = await this.homework
        .scopedBy({ permissions: auth.permissions })
        .findAll({ where: { enrollmentId: query.enrollmentId, status: query.status } })

      return {
        items: found.map((h) => this.mapper.map(h, entities.Homework, dto.HomeworkSummary)),
      }
    }

    // A student without the permission sees only their own work, which is found
    // through their enrollments rather than by trusting an id in the query.
    const mine = await this.enrollments.findAll({ where: { studentId: auth.userId } })
    const found = await this.homework.findAll({
      where: mine.map((e) => ({ enrollmentId: e.id, status: query.status })),
    })

    return {
      items: found.map((h) => this.mapper.map(h, entities.Homework, dto.HomeworkSummary)),
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                            GET /edu/homework/:id                           */
  /* -------------------------------------------------------------------------- */

  @Crud.GetOne(Routes().edu.homework.get(':id'))
  async getOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetHomeworkResponse> {
    const work = await this.homework.findOneBy({ id })

    if (!work) {
      throw new NotFoundException(`Homework with id ${id} not found`)
    }

    await this.assertMayRead(work, auth)

    return this.mapper.map(work, entities.Homework, dto.GetHomeworkResponse)
  }

  /* -------------------------------------------------------------------------- */
  /*                       PATCH /edu/homework/:id/review                       */
  /* -------------------------------------------------------------------------- */

  @Crud.UpdateOne(Routes().edu.homework.review(':id'))
  async review(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() request: dto.ReviewHomeworkRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.ReviewHomeworkResponse> {
    const work = await this.homework.findOneBy({ id })

    if (!work) {
      throw new NotFoundException(`Homework with id ${id} not found`)
    }

    if (!auth.permissions.has(['homework:grade'], { schoolId: work.schoolId })) {
      throw new ForbiddenException('User does not have permission')
    }

    if (!canTransitionHomework(work.status, request.status)) {
      throw new ConflictException(`Cannot move work from ${work.status} to ${request.status}`)
    }

    const updated = await this.homework.updateOneBy(
      { id },
      {
        status: request.status,
        grade: request.status === 'accepted' ? request.grade : null,
        reviewedById: auth.userId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      },
    )

    return this.mapper.map(updated, entities.Homework, dto.ReviewHomeworkResponse)
  }

  /* -------------------------------------------------------------------------- */
  /*                                  Helpers                                   */
  /* -------------------------------------------------------------------------- */

  /** The student's accepted place on the course this lesson belongs to. */
  private async enrollmentForLessonVersion(lessonId: string, studentId: string) {
    const lesson = await this.lessons.findOneBy({ id: lessonId })

    if (!lesson) {
      throw new NotFoundException(`Lesson with id ${lessonId} not found`)
    }

    const enrollment = await this.enrollments.findOneBy({
      studentId,
      courseId: lesson.courseId,
      status: 'accepted',
    })

    // Access to course content comes from being enrolled, not from a permission.
    // A pending or declined request is not a place on the course.
    if (!enrollment) {
      throw new ForbiddenException('Not enrolled on the course this lesson belongs to')
    }

    return enrollment
  }

  private async assertMayRead(work: entities.Homework, auth: UserAuthentication): Promise<void> {
    if (auth.permissions.has(['homework:read'], { schoolId: work.schoolId })) return

    const enrollment = await this.enrollments.findOneBy({ id: work.enrollmentId })

    if (enrollment?.studentId !== auth.userId) {
      throw new ForbiddenException('User does not have permission')
    }
  }
}
