import { Body, Controller, Query, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthenticatedUserGuard } from '@vidya/api/auth/guards'
import * as dto from '@vidya/api/edu/dto'
import { RolesService } from '@vidya/api/edu/services'
import { CrudDecorators } from '@vidya/api/shared/decorators'
import { Routes } from '@vidya/protocol'

import { toUserRoles } from '../../mappers/org.mapper'

// TODO Add documentation configurations, to change doc:
//      Get many UserRoles    -> Get all roles of a user
//      Create a new UserRole -> Set roles for a user
const Crud = CrudDecorators({
  entityName: 'UserRole',
  getManyResponseDto: dto.GetUserRolesListResponse,
  createOneResponseDto: dto.SetUserRolesResponse,
})

@Controller()
@ApiTags('🧝 Education :: Users')
@UseGuards(AuthenticatedUserGuard)
export class UserRolesController {
  constructor(private readonly rolesService: RolesService) {}

  /* -------------------------------------------------------------------------- */
  /*                        GET /edu/users/:userId/roles                        */
  /* -------------------------------------------------------------------------- */

  @Crud.GetMany(Routes().edu.user(':userId').roles.all())
  async getAll(
    @Query() request: dto.GetUserRolesListRequest,
  ): Promise<dto.GetUserRolesListResponse> {
    const roles = await this.rolesService.getRolesOfUser(request.userId)
    const userRoles = toUserRoles(roles)
    return new dto.GetUserRolesListResponse(userRoles)
  }

  /* -------------------------------------------------------------------------- */
  /*                        POST /edu/users/:userId/roles                       */
  /* -------------------------------------------------------------------------- */

  @Crud.CreateOne(Routes().edu.user(':userId').roles.create())
  async set(
    @Query() query: dto.SetUserRolesQuery,
    @Body() request: dto.SetUserRolesRequest,
  ): Promise<dto.SetUserRolesResponse> {
    await this.rolesService.setRolesForUser(query.userId, request.roleIds)
    return new dto.SetUserRolesResponse()
  }
}
