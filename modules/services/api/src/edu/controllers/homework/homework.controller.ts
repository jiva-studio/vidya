import {
  Body,
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
import * as entities from '@vidya/entities'
import { Routes } from '@vidya/protocol'

import { toHomeworkDetails, toHomeworkSummaries } from '../../mappers/education.mapper'

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

    const enrollment = await this.enrollments.forLessonVersion(request.lessonVersionId, auth.userId)

    const saved = await this.homework.submit({
      enrollment,
      version,
      sectionId: request.sectionId,
      text: request.text,
    })

    return toHomeworkDetails(saved)
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

      return { items: toHomeworkSummaries(found) }
    }

    // A student without the permission sees only their own work, which is found
    // through their enrollments rather than by trusting an id in the query.
    const mine = await this.enrollments.findAll({ where: { studentId: auth.userId } })
    const found = await this.homework.forEnrollments(mine, query.status)

    return { items: toHomeworkSummaries(found) }
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

    return toHomeworkDetails(work)
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

    const updated = await this.homework.review(work, {
      status: request.status,
      grade: request.grade,
      reviewerId: auth.userId,
    })

    return toHomeworkDetails(updated)
  }

  /* -------------------------------------------------------------------------- */
  /*                                  Helpers                                   */
  /* -------------------------------------------------------------------------- */

  private async assertMayRead(work: entities.Homework, auth: UserAuthentication): Promise<void> {
    if (auth.permissions.has(['homework:read'], { schoolId: work.schoolId })) return

    const enrollment = await this.enrollments.findOneBy({ id: work.enrollmentId })

    if (!this.enrollments.isOwnedBy(enrollment, auth.userId)) {
      throw new ForbiddenException('User does not have permission')
    }
  }
}
