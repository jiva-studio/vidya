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
import { CoursesService, GroupsService } from '@vidya/api/edu/services'
import { CrudDecorators } from '@vidya/api/shared/decorators'
import { Routes } from '@vidya/protocol'

import { toCreatedId, toGroupDetails, toGroupSummaries } from '../../mappers/education.mapper'

const Crud = CrudDecorators({
  entityName: 'Group',
  getOneResponseDto: dto.GetGroupResponse,
  getManyResponseDto: dto.GetGroupsResponse,
  createOneResponseDto: dto.CreateGroupResponse,
  updateOneResponseDto: dto.UpdateGroupResponse,
  deleteOneResponseDto: dto.DeleteGroupResponse,
})

@Controller()
@ApiTags('🎓 Education :: Groups')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
export class GroupsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly courses: CoursesService,
  ) {}

  /* -------------------------------------------------------------------------- */
  /*                            GET /edu/groups/:id                            */
  /* -------------------------------------------------------------------------- */

  @Crud.GetOne(Routes().edu.groups.get(':id'))
  async getOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetGroupResponse> {
    if (!auth.permissions.has(['groups:read'])) {
      throw new ForbiddenException('User does not have permission')
    }

    const group = await this.groups
      .scopedBy({ permissions: auth.permissions })
      .findOne({ where: { id } })

    if (!group) {
      throw new NotFoundException(`Group with id ${id} not found`)
    }

    return toGroupDetails(group)
  }

  /* -------------------------------------------------------------------------- */
  /*                              GET /edu/groups                              */
  /* -------------------------------------------------------------------------- */

  @Crud.GetMany(Routes().edu.groups.find())
  async getMany(
    @Query() query: dto.GetGroupsQuery,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetGroupsResponse> {
    if (!auth.permissions.has(['groups:read'])) {
      throw new ForbiddenException('User does not have permission')
    }

    const groups = await this.groups
      .scopedBy({ permissions: auth.permissions })
      .findAll({ where: { courseId: query.courseId } })

    return { items: toGroupSummaries(groups) }
  }

  /* -------------------------------------------------------------------------- */
  /*                              POST /edu/groups                             */
  /* -------------------------------------------------------------------------- */

  @Crud.CreateOne(Routes().edu.groups.create())
  async createOne(
    @Body() request: dto.CreateGroupRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.CreateGroupResponse> {
    // The request names no school, so it comes from the course the caller may already see.
    const course = await this.courses
      .scopedBy({ permissions: auth.permissions })
      .findOne({ where: { id: request.courseId } })

    if (!course) {
      throw new NotFoundException(`Course with id ${request.courseId} not found`)
    }

    if (!auth.permissions.has(['groups:create'], { schoolId: course.schoolId })) {
      throw new ForbiddenException('User does not have permission')
    }

    const created = await this.groups.create({
      courseId: request.courseId,
      name: request.name,
      description: request.description,
      schoolId: course.schoolId,
    })

    return toCreatedId(created)
  }

  /* -------------------------------------------------------------------------- */
  /*                           PATCH /edu/groups/:id                           */
  /* -------------------------------------------------------------------------- */

  @Crud.UpdateOne(Routes().edu.groups.update(':id'))
  async updateOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() request: dto.UpdateGroupRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.UpdateGroupResponse> {
    if (!auth.permissions.has(['groups:update'])) {
      throw new ForbiddenException('User does not have permission')
    }

    const group = await this.groups
      .scopedBy({ permissions: auth.permissions })
      .findOne({ where: { id } })

    if (!group) {
      throw new NotFoundException(`Group with id ${id} not found`)
    }

    const updated = await this.groups.updateOneBy({ id }, request)
    return toGroupDetails(updated)
  }

  /* -------------------------------------------------------------------------- */
  /*                          DELETE /edu/groups/:id                           */
  /* -------------------------------------------------------------------------- */

  @Crud.DeleteOne(Routes().edu.groups.delete(':id'))
  async deleteOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.DeleteGroupResponse> {
    if (!auth.permissions.has(['groups:delete'])) {
      throw new ForbiddenException('User does not have permission')
    }

    const group = await this.groups
      .scopedBy({ permissions: auth.permissions })
      .findOne({ where: { id } })

    if (!group) {
      throw new NotFoundException(`Group with id ${id} not found`)
    }

    await this.groups.deleteOneBy({ id })
    return { success: true }
  }
}
