import {
  BadRequestException,
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
import { RoleExistsPipe } from '@vidya/api/edu/pipes'
import { RolesService } from '@vidya/api/edu/services'
import { assertPermissionsGrantable } from '@vidya/api/edu/validations'
import { CrudDecorators } from '@vidya/api/shared/decorators'
import * as domain from '@vidya/domain'
import { Routes } from '@vidya/protocol'

import { toId, toRoleDetails, toRoleSummaries } from '../../mappers/org.mapper'

const Crud = CrudDecorators({
  entityName: 'Role',
  getOneResponseDto: dto.GetRoleResponse,
  getManyResponseDto: dto.GetRolesResponse,
  createOneResponseDto: dto.CreateRoleResponse,
  updateOneResponseDto: dto.UpdateRoleResponse,
  deleteOneResponseDto: dto.DeleteRoleResponse,
})

@Controller()
@ApiTags('🕵️‍♂️ Education :: Roles')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}
  /* -------------------------------------------------------------------------- */
  /*                             GET /edu/roles/:id                             */
  /* -------------------------------------------------------------------------- */

  @Crud.GetOne(Routes().edu.roles.get(':id'))
  async getOne(
    @Param('id', new ParseUUIDPipe()) id: domain.RoleId,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetRoleResponse> {
    // Check if user has permission to read roles
    if (!auth.permissions.has(['roles:read'])) {
      throw new ForbiddenException('User does not have permission')
    }

    // Get role by Id with user permissions scope
    const role = await this.rolesService
      .scopedBy({ permissions: auth.permissions })
      .findOne({ where: { id } })

    // No role found with the given Id
    if (!role) {
      throw new NotFoundException(`Role with id ${id} not found`)
    }

    // Return role details
    return toRoleDetails(role)
  }

  /* -------------------------------------------------------------------------- */
  /*                               GET /edu/roles                               */
  /* -------------------------------------------------------------------------- */

  @Crud.GetMany(Routes().edu.roles.find())
  async getMany(
    @Query() filters: dto.GetRoleSummariesListQuery,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetRolesResponse> {
    // Check if user has permission to read roles
    if (!auth.permissions.has(['roles:read'])) {
      throw new ForbiddenException('User does not have permission')
    }

    // Get one page of roles
    const [roles, total] = await this.rolesService
      .scopedBy({ permissions: auth.permissions })
      .findAndCount({
        where: { ...dto.matchingName(filters.query), schoolId: filters.schoolId },
        order: { name: 'ASC', id: 'ASC' },
        ...dto.pageOf(filters),
      })

    // Return role summaries
    return new dto.GetRolesResponse({ items: toRoleSummaries(roles), total })
  }

  /* -------------------------------------------------------------------------- */
  /*                               POST /edu/roles                              */
  /* -------------------------------------------------------------------------- */

  @Crud.CreateOne(Routes().edu.roles.create())
  async createOne(
    @Body() request: dto.CreateRoleRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.CreateRoleResponse> {
    // Check if user has permission to create roles
    if (
      !auth.permissions.has(['roles:create'], {
        schoolId: request.schoolId,
      })
    ) {
      throw new ForbiddenException('User does not have permission')
    }

    // Refuse to grant a permission the caller does not hold in this school
    assertPermissionsGrantable(request.permissions, request.schoolId, auth.permissions)

    // Create role
    const entity = await this.rolesService.create(
      {
        name: request.name,
        description: request.description,
        permissions: request.permissions,
        schoolId: request.schoolId,
      },
      auth.userId,
    )

    // Return created role details
    return toId(entity)
  }

  /* -------------------------------------------------------------------------- */
  /*                            PATCH /edu/roles/:id                            */
  /* -------------------------------------------------------------------------- */

  @Crud.UpdateOne(Routes().edu.roles.update(':id'))
  async updateOne(
    @Param('id', new ParseUUIDPipe(), RoleExistsPipe) id: domain.RoleId,
    @Body() request: dto.UpdateRoleRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.UpdateRoleResponse> {
    // Check if user has permission to update role
    let role = await this.rolesService.findOneBy({ id })
    if (
      !auth.permissions.has(['roles:update'], {
        schoolId: role.schoolId,
      })
    ) {
      throw new ForbiddenException('User does not have permission')
    }

    // Refuse to grant a permission the caller does not hold in this school.
    // Checked against the caller's own permissions, never the role's previous
    // ones — otherwise removing one permission and adding another becomes a
    // way around it.
    if (request.permissions) {
      assertPermissionsGrantable(request.permissions, role.schoolId, auth.permissions)
    }

    // Update role
    role = await this.rolesService.updateOneBy(
      { id },
      {
        name: request.name,
        description: request.description,
        permissions: request.permissions,
      },
      auth.userId,
    )

    // Return updated role details
    return toRoleDetails(role)
  }

  /* -------------------------------------------------------------------------- */
  /*                            DELETE /edu/roles/:id                           */
  /* -------------------------------------------------------------------------- */

  @Crud.DeleteOne(Routes().edu.roles.delete(':id'))
  async deleteOne(
    @Param('id', new ParseUUIDPipe(), RoleExistsPipe) id: domain.RoleId,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.DeleteRoleResponse> {
    // Check if user has permission to delete role
    const role = await this.rolesService.findOneBy({ id })
    if (
      !auth.permissions.has(['roles:delete'], {
        schoolId: role.schoolId,
      })
    ) {
      throw new ForbiddenException('User does not have permission')
    }

    if (role && role.permissions.includes('*')) {
      throw new BadRequestException('Cannot delete Owner role')
    }

    // Delete role
    await this.rolesService.deleteOneBy({ id }, auth.userId)

    // Return success response
    return new dto.DeleteRoleResponse({ success: true })
  }
}
