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
import { EnrollmentsService, HomeworkService } from '@vidya/api/edu/services'
import { CrudDecorators } from '@vidya/api/shared/decorators'
import * as domain from '@vidya/domain'
import * as entities from '@vidya/entities'
import { Routes } from '@vidya/protocol'

import { toHomeworkDetails, toHomeworkSummaries } from '../../mappers/education.mapper'

const Crud = CrudDecorators({
  entityName: 'Homework',
  getOneResponseDto: dto.GetHomeworkResponse,
  getManyResponseDto: dto.GetHomeworkListResponse,
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
  ) {}

  /* -------------------------------------------------------------------------- */
  /*                              GET /edu/homework                             */
  /* -------------------------------------------------------------------------- */

  /** Staff only: a student reads their own answers off a sync pull, not off this list. */
  @Crud.GetMany(Routes().edu.homework.find())
  async getMany(
    @Query() query: dto.GetHomeworkQuery,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetHomeworkListResponse> {
    const [found, total] = await this.homework
      .scopedBy({ permissions: auth.permissions })
      .findAndCount({
        where: {
          enrollmentId: query.enrollmentId,
          status: query.status,
          schoolId: query.schoolId,
        },
        order: { createdAt: 'DESC', id: 'ASC' },
        ...dto.pageOf(query),
      })

    return { items: toHomeworkSummaries(found), total }
  }

  /* -------------------------------------------------------------------------- */
  /*                            GET /edu/homework/:id                           */
  /* -------------------------------------------------------------------------- */

  @Crud.GetOne(Routes().edu.homework.get(':id'))
  async getOne(
    @Param('id', new ParseUUIDPipe()) id: domain.HomeworkId,
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
    @Param('id', new ParseUUIDPipe()) id: domain.HomeworkId,
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
      comment: request.comment,
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
