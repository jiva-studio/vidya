import {
  Body,
  Controller,
  ForbiddenException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Authentication } from '@vidya/api/auth/decorators'
import { AuthenticatedUserGuard } from '@vidya/api/auth/guards'
import { UserAuthentication } from '@vidya/api/auth/utils'
import * as dto from '@vidya/api/edu/dto'
import { UserExistsPipe } from '@vidya/api/edu/pipes'
import { RolesService } from '@vidya/api/edu/services'
import { CrudDecorators } from '@vidya/api/shared/decorators'
import * as domain from '@vidya/domain'
import { Routes } from '@vidya/protocol'

import { toUserRoles } from '../../mappers/org.mapper'

// TODO: relabel the generated Swagger operations for this resource.
const Crud = CrudDecorators({
  entityName: 'UserRole',
  getManyResponseDto: dto.GetUserRolesListResponse,
  createOneResponseDto: dto.SetUserRolesResponse,
})

@Controller()
@ApiTags('🧝 Education :: Users')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
export class UserRolesController {
  constructor(private readonly rolesService: RolesService) {}

  /* -------------------------------------------------------------------------- */
  /*                        GET /edu/users/:userId/roles                        */
  /* -------------------------------------------------------------------------- */

  @Crud.GetMany(Routes().edu.user(':userId').roles.all())
  async getAll(
    @Param('userId', new ParseUUIDPipe(), UserExistsPipe) userId: domain.UserId,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetUserRolesListResponse> {
    const schoolIds = auth.permissions.getScopes(['users:read']).map((s) => s.schoolId)

    if (schoolIds.length === 0) {
      throw new ForbiddenException('User does not have permission')
    }

    const roles = await this.rolesService.getRolesOfUserWithin(userId, schoolIds)
    return new dto.GetUserRolesListResponse(toUserRoles(roles))
  }

  /* -------------------------------------------------------------------------- */
  /*                        POST /edu/users/:userId/roles                       */
  /* -------------------------------------------------------------------------- */

  @Crud.CreateOne(Routes().edu.user(':userId').roles.create())
  async set(
    @Param('userId', new ParseUUIDPipe(), UserExistsPipe) userId: domain.UserId,
    @Body() request: dto.SetUserRolesRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.SetUserRolesResponse> {
    const schoolIds = auth.permissions.getScopes(['users:update']).map((s) => s.schoolId)

    await this.rolesService.setRolesForUserWithin(userId, request.roleIds, schoolIds)
    return new dto.SetUserRolesResponse()
  }
}
