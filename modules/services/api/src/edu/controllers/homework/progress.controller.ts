import {
  Body,
  Controller,
  ForbiddenException,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Authentication } from '@vidya/api/auth/decorators'
import { AuthenticatedUserGuard } from '@vidya/api/auth/guards'
import { UserAuthentication } from '@vidya/api/auth/utils'
import * as dto from '@vidya/api/edu/dto'
import { BlockStatesService, EnrollmentsService } from '@vidya/api/edu/services'
import { CrudDecorators } from '@vidya/api/shared/decorators'
import * as domain from '@vidya/domain'
import * as entities from '@vidya/entities'
import { Routes } from '@vidya/protocol'

import { toBlockStateDetails, toBlockStateDetailsList } from '../../mappers/education.mapper'

const Crud = CrudDecorators({
  entityName: 'BlockState',
  getOneResponseDto: dto.BlockStateDetails,
  getManyResponseDto: dto.GetBlockStatesResponse,
  createOneResponseDto: dto.SaveBlockStateResponse,
  updateOneResponseDto: dto.SaveBlockStateResponse,
  deleteOneResponseDto: dto.BlockStateDetails,
})

@Controller()
@ApiTags('🎓 Education :: Progress')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
export class ProgressController {
  constructor(
    private readonly blockStates: BlockStatesService,
    private readonly enrollments: EnrollmentsService,
  ) {}

  /* -------------------------------------------------------------------------- */
  /*                             POST /edu/progress                             */
  /* -------------------------------------------------------------------------- */

  /**
   * Records how far a student got through one block. Idempotent by
   * (enrollment, version, block) so the offline client can replay a push
   * without creating duplicates.
   */
  @Crud.CreateOne(Routes().edu.progress.save())
  async save(
    @Body() request: dto.SaveBlockStateRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.SaveBlockStateResponse> {
    const enrollment = await this.enrollments.forLessonVersion(request.lessonVersionId, auth.userId)

    const existing = await this.blockStates.findOneBy({
      enrollmentId: enrollment.id,
      lessonVersionId: request.lessonVersionId,
      blockId: request.blockId,
    })

    const fields = {
      enrollmentId: enrollment.id,
      lessonVersionId: request.lessonVersionId,
      blockId: request.blockId,
      schoolId: enrollment.schoolId,
      state: request.state,
      updatedAt: new Date(),
    }

    const saved = existing
      ? await this.blockStates.updateOneBy({ id: existing.id }, fields)
      : await this.blockStates.create(fields)

    return toBlockStateDetails(saved)
  }

  /* -------------------------------------------------------------------------- */
  /*                              GET /edu/progress                             */
  /* -------------------------------------------------------------------------- */

  /**
   * Progress for one enrolment, or for every enrolment the caller holds.
   *
   * The id is optional because a student has several places and, on a first
   * run, knows none of their ids — without this the client has nothing to ask
   * with at all.
   */
  @Crud.GetMany(Routes().edu.progress.find())
  async getMany(
    @Query() query: dto.GetBlockStatesQuery,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetBlockStatesResponse> {
    const states = query.enrollmentId
      ? await this.statesOf(query.enrollmentId, query.lessonVersionId, auth)
      : await this.myStates(query.lessonVersionId, auth)

    return { items: toBlockStateDetailsList(states) }
  }

  /* -------------------------------------------------------------------------- */
  /*                                  Helpers                                   */
  /* -------------------------------------------------------------------------- */

  private async statesOf(
    enrollmentId: domain.EnrollmentId,
    lessonVersionId: domain.LessonVersionId | undefined,
    auth: UserAuthentication,
  ): Promise<entities.BlockState[]> {
    const enrollment = await this.enrollments.findOneBy({ id: enrollmentId })

    if (!enrollment) {
      throw new NotFoundException(`Enrollment with id ${enrollmentId} not found`)
    }

    const isOwner = this.enrollments.isOwnedBy(enrollment, auth.userId)
    const isStaff = auth.permissions.has(['homework:read'], { schoolId: enrollment.schoolId })

    if (!isOwner && !isStaff) {
      throw new ForbiddenException('User does not have permission')
    }

    return this.blockStates.findAll({ where: { enrollmentId, lessonVersionId } })
  }

  /** Own progress only — staff permissions widen nothing here, by design. */
  private async myStates(
    lessonVersionId: domain.LessonVersionId | undefined,
    auth: UserAuthentication,
  ): Promise<entities.BlockState[]> {
    const mine = await this.enrollments.findAll({ where: { studentId: auth.userId } })

    if (mine.length === 0) return []

    return this.blockStates.findAll({
      where: mine.map((e) => ({ enrollmentId: e.id, lessonVersionId })),
    })
  }
}
