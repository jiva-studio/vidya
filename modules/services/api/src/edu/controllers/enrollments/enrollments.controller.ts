import {
  Body,
  Controller,
  ForbiddenException,
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
import { EnrollmentsService, visibleToSchool, visibleToStudent } from '@vidya/api/edu/services'
import { CrudDecorators } from '@vidya/api/shared/decorators'
import * as domain from '@vidya/domain'
import { Routes } from '@vidya/protocol'

import { toEnrollmentDetails, toEnrollmentSummaries } from '../../mappers/education.mapper'

const Crud = CrudDecorators({
  entityName: 'Enrollment',
  getOneResponseDto: dto.GetEnrollmentResponse,
  getManyResponseDto: dto.GetEnrollmentsResponse,
  updateOneResponseDto: dto.ModerateEnrollmentResponse,
  deleteOneResponseDto: dto.DeleteEnrollmentResponse,
})

@Controller()
@ApiTags('🎓 Education :: Enrollments')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
export class EnrollmentsController {
  constructor(private readonly enrollments: EnrollmentsService) {}

  /* -------------------------------------------------------------------------- */
  /*                            GET /edu/enrollments                            */
  /* -------------------------------------------------------------------------- */

  @Crud.GetMany(Routes().edu.enrollments.find())
  async getMany(
    @Query() query: dto.GetEnrollmentsQuery,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetEnrollmentsResponse> {
    const where = {
      courseId: query.courseId,
      groupId: query.groupId,
      status: query.status,
    }

    // Staff see the school's enrollments; everyone else sees only their own, and
    // each side is shown its own list with its own tidying-up taken off it.
    const page = { order: { createdAt: 'DESC', id: 'ASC' } as const, ...dto.pageOf(query) }

    const [found, total] = auth.permissions.has(['enrollments:read'])
      ? await this.enrollments.scopedBy({ permissions: auth.permissions }).findAndCount({
          where: {
            ...where,
            schoolId: query.schoolId,
            studentId: query.studentId,
            ...visibleToSchool(),
          },
          ...page,
        })
      : await this.enrollments.findAndCount({
          where: { ...where, studentId: auth.userId, ...visibleToStudent() },
          ...page,
        })

    return { items: toEnrollmentSummaries(found), total }
  }

  /* -------------------------------------------------------------------------- */
  /*                          GET /edu/enrollments/:id                          */
  /* -------------------------------------------------------------------------- */

  /** Staff only: a student reads their own places off the list route, or off a sync pull. */
  @Crud.GetOne(Routes().edu.enrollments.get(':id'))
  async getOne(
    @Param('id', new ParseUUIDPipe()) id: domain.EnrollmentId,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetEnrollmentResponse> {
    const enrollment = await this.enrollments.getOrFail(id)

    if (!auth.permissions.has(['enrollments:read'], { schoolId: enrollment.schoolId })) {
      throw new ForbiddenException('User does not have permission')
    }

    return toEnrollmentDetails(enrollment)
  }

  /* -------------------------------------------------------------------------- */
  /*                  PATCH /edu/enrollments/:id/moderation                     */
  /* -------------------------------------------------------------------------- */

  @Crud.UpdateOne(Routes().edu.enrollments.moderate(':id'))
  async moderate(
    @Param('id', new ParseUUIDPipe()) id: domain.EnrollmentId,
    @Body() request: dto.ModerateEnrollmentRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.ModerateEnrollmentResponse> {
    const enrollment = await this.enrollments.getOrFail(id)

    if (!auth.permissions.has(['enrollments:moderate'], { schoolId: enrollment.schoolId })) {
      throw new ForbiddenException('User does not have permission')
    }

    const updated = await this.enrollments.moderate(enrollment, {
      status: request.status,
      groupId: request.groupId,
      decidedById: auth.userId,
    })

    return toEnrollmentDetails(updated)
  }

  /* -------------------------------------------------------------------------- */
  /*                    PATCH /edu/enrollments/:id/archive                      */
  /* -------------------------------------------------------------------------- */

  /**
   * The school puts an answered row out of its own sight.
   *
   * Guarded by the key that answers requests rather than one of its own:
   * whoever moderates is who ends up with the list to keep, and a separate key
   * would answer 403 to every member of staff already doing the job.
   */
  @Crud.UpdateOne(Routes().edu.enrollments.archive(':id'))
  async archive(
    @Param('id', new ParseUUIDPipe()) id: domain.EnrollmentId,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.ArchiveEnrollmentResponse> {
    const enrollment = await this.enrollments.getOrFail(id)

    if (!auth.permissions.has(['enrollments:moderate'], { schoolId: enrollment.schoolId })) {
      throw new ForbiddenException('User does not have permission')
    }

    return toEnrollmentDetails(await this.enrollments.archiveForSchool(enrollment, auth.userId))
  }

  /* -------------------------------------------------------------------------- */
  /*                     PATCH /edu/enrollments/:id/group                       */
  /* -------------------------------------------------------------------------- */

  @Crud.UpdateOne(Routes().edu.enrollments.group(':id'))
  async assignGroup(
    @Param('id', new ParseUUIDPipe()) id: domain.EnrollmentId,
    @Body() request: dto.AssignEnrollmentGroupRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.AssignEnrollmentGroupResponse> {
    const enrollment = await this.enrollments.getOrFail(id)

    if (!auth.permissions.has(['enrollments:moderate'], { schoolId: enrollment.schoolId })) {
      throw new ForbiddenException('User does not have permission')
    }

    const updated = await this.enrollments.assignGroup(enrollment, request.groupId)

    return toEnrollmentDetails(updated)
  }
}
