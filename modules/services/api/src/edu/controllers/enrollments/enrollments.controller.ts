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
import { CoursesService, EnrollmentsService, GroupsService } from '@vidya/api/edu/services'
import { CrudDecorators } from '@vidya/api/shared/decorators'
import * as entities from '@vidya/entities'
import { Routes } from '@vidya/protocol'

const Crud = CrudDecorators({
  entityName: 'Enrollment',
  getOneResponseDto: dto.GetEnrollmentResponse,
  getManyResponseDto: dto.GetEnrollmentsResponse,
  createOneResponseDto: dto.CreateEnrollmentResponse,
  updateOneResponseDto: dto.ModerateEnrollmentResponse,
  deleteOneResponseDto: dto.DeleteEnrollmentResponse,
})

@Controller()
@ApiTags('🎓 Education :: Enrollments')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
export class EnrollmentsController {
  constructor(
    private readonly enrollments: EnrollmentsService,
    private readonly courses: CoursesService,
    private readonly groups: GroupsService,
    @InjectMapper() private readonly mapper: Mapper,
  ) {}

  /* -------------------------------------------------------------------------- */
  /*                            POST /edu/enrollments                           */
  /* -------------------------------------------------------------------------- */

  /**
   * A student asks to join a course.
   *
   * This is the one route a student reaches without holding any permission:
   * access to a course comes from being enrolled on it, not from a permission
   * key, so requiring one here would make enrolling impossible.
   */
  @Crud.CreateOne(Routes().edu.enrollments.create())
  async createOne(
    @Body() request: dto.CreateEnrollmentRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.CreateEnrollmentResponse> {
    const course = await this.courses.findOneBy({ id: request.courseId })

    if (!course) {
      throw new NotFoundException(`Course with id ${request.courseId} not found`)
    }

    const existing = await this.enrollments.findOneBy({
      courseId: request.courseId,
      studentId: auth.userId,
    })

    if (existing) {
      throw new ConflictException('Already enrolled on this course')
    }

    // The request starts pending: a school decides who joins, and which group
    // they land in. Until then groupId stays empty and the student waits.
    const created = await this.enrollments.create({
      courseId: request.courseId,
      studentId: auth.userId,
      schoolId: course.schoolId,
      status: 'pending',
    })

    return this.mapper.map(created, entities.Enrollment, dto.CreateEnrollmentResponse)
  }

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

    // Staff see the school's enrollments; everyone else sees their own, which is
    // how a student reads the status of a request they made.
    const found = auth.permissions.has(['enrollments:read'])
      ? await this.enrollments
          .scopedBy({ permissions: auth.permissions })
          .findAll({ where: { ...where, studentId: query.studentId } })
      : await this.enrollments.findAll({ where: { ...where, studentId: auth.userId } })

    return {
      items: found.map((e) => this.mapper.map(e, entities.Enrollment, dto.EnrollmentSummary)),
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                          GET /edu/enrollments/:id                          */
  /* -------------------------------------------------------------------------- */

  @Crud.GetOne(Routes().edu.enrollments.get(':id'))
  async getOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetEnrollmentResponse> {
    const enrollment = await this.enrollments.findOneBy({ id })

    if (!enrollment) {
      throw new NotFoundException(`Enrollment with id ${id} not found`)
    }

    const isOwner = enrollment.studentId === auth.userId
    const isStaff = auth.permissions.has(['enrollments:read'], {
      schoolId: enrollment.schoolId,
    })

    if (!isOwner && !isStaff) {
      throw new ForbiddenException('User does not have permission')
    }

    return this.mapper.map(enrollment, entities.Enrollment, dto.GetEnrollmentResponse)
  }

  /* -------------------------------------------------------------------------- */
  /*                  PATCH /edu/enrollments/:id/moderation                     */
  /* -------------------------------------------------------------------------- */

  @Crud.UpdateOne(Routes().edu.enrollments.moderate(':id'))
  async moderate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() request: dto.ModerateEnrollmentRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.ModerateEnrollmentResponse> {
    const enrollment = await this.enrollments.findOneBy({ id })

    if (!enrollment) {
      throw new NotFoundException(`Enrollment with id ${id} not found`)
    }

    if (!auth.permissions.has(['enrollments:moderate'], { schoolId: enrollment.schoolId })) {
      throw new ForbiddenException('User does not have permission')
    }

    if (enrollment.status !== 'pending') {
      throw new ConflictException(`Enrollment ${id} has already been decided`)
    }

    if (request.groupId) {
      await this.assertGroupBelongsToCourse(request.groupId, enrollment.courseId)
    }

    const updated = await this.enrollments.updateOneBy(
      { id },
      {
        status: request.status,
        // Accepting without a group is deliberate: the student is in, and waits
        // in the queue until a suitable group exists.
        groupId: request.groupId ?? null,
        decidedById: auth.userId,
        decidedAt: new Date(),
      },
    )

    return this.mapper.map(updated, entities.Enrollment, dto.ModerateEnrollmentResponse)
  }

  /* -------------------------------------------------------------------------- */
  /*                     PATCH /edu/enrollments/:id/group                       */
  /* -------------------------------------------------------------------------- */

  @Crud.UpdateOne(Routes().edu.enrollments.group(':id'))
  async assignGroup(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() request: dto.AssignEnrollmentGroupRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.AssignEnrollmentGroupResponse> {
    const enrollment = await this.enrollments.findOneBy({ id })

    if (!enrollment) {
      throw new NotFoundException(`Enrollment with id ${id} not found`)
    }

    if (!auth.permissions.has(['enrollments:moderate'], { schoolId: enrollment.schoolId })) {
      throw new ForbiddenException('User does not have permission')
    }

    if (enrollment.status !== 'accepted') {
      throw new ConflictException(`Enrollment ${id} is not accepted`)
    }

    if (request.groupId) {
      await this.assertGroupBelongsToCourse(request.groupId, enrollment.courseId)
    }

    const updated = await this.enrollments.updateOneBy({ id }, { groupId: request.groupId })

    return this.mapper.map(updated, entities.Enrollment, dto.AssignEnrollmentGroupResponse)
  }

  /**
   * A group belongs to exactly one course. Placing a student in a group from a
   * different course would give them a place in a course they never applied to.
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
