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
import { GetUsersResponse } from '@vidya/api/edu/dto'
import { UserExistsPipe } from '@vidya/api/edu/pipes'
import { RolesService, UsersService } from '@vidya/api/edu/services'
import { CrudDecorators } from '@vidya/api/shared/decorators'
import * as domain from '@vidya/domain'
import { Routes } from '@vidya/protocol'

import { toUserDetails, toUserSummaries } from '../../mappers/org.mapper'

const Crud = CrudDecorators({
  entityName: 'User',
  getOneResponseDto: dto.GetUserResponse,
  getManyResponseDto: dto.GetUsersResponse,
  updateOneResponseDto: dto.UpdateUserResponse,
})

@Controller()
@ApiBearerAuth()
@ApiTags('🧝 Education :: Users')
@UseGuards(AuthenticatedUserGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
  ) {}

  /* -------------------------------------------------------------------------- */
  /*                             GET /edu/users/:id                             */
  /* -------------------------------------------------------------------------- */

  @Crud.GetOne(Routes().edu.user(':id').get())
  async getOne(
    @Param('id', new ParseUUIDPipe()) id: domain.UserId,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetUserResponse> {
    // Check if user has permission to read users
    if (!auth.permissions.has(['users:read'])) {
      throw new ForbiddenException('User does not have permission')
    }

    // Get user by Id with user permissions scope
    const foundUser = await this.usersService
      .scopedBy({ permissions: auth.permissions })
      .findOne({ where: { id } })

    // Throw an error if user is not found
    if (!foundUser) {
      throw new NotFoundException(`User with id ${id} not found`)
    }

    // Return user response
    return toUserDetails(foundUser)
  }

  /* -------------------------------------------------------------------------- */
  /*                               GET /edu/users                               */
  /* -------------------------------------------------------------------------- */

  @Crud.GetMany(Routes().edu.user(':id').find())
  async getMany(
    @Query() query: dto.GetUsersQuery,
    @Authentication() auth: UserAuthentication,
  ): Promise<GetUsersResponse> {
    // Check if user has permission to read users
    if (!auth.permissions.has(['users:read'])) {
      throw new ForbiddenException('User does not have permission')
    }

    // Get users with user permissions scope
    const users = await this.usersService.scopedBy({ permissions: auth.permissions }).findAll({
      where: {
        roles: {
          schoolId: query.schoolId,
        },
      },
    })

    // Return users response
    return new dto.GetUsersResponse({
      items: toUserSummaries(users),
    })
  }

  /* -------------------------------------------------------------------------- */
  /*                           PATCH /edu/users/:id                             */
  /* -------------------------------------------------------------------------- */

  @Crud.UpdateOne(Routes().edu.user(':id').update())
  async updateOne(
    @Body() request: dto.UpdateUserRequest,
    @Param('id', new ParseUUIDPipe(), UserExistsPipe) id: domain.UserId,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.UpdateUserResponse> {
    // TODO user can update himself without any permission
    const roles = await this.rolesService.getRolesOfUser(id)
    const scopes = roles.map((role) => ({
      schoolId: role.schoolId,
    }))

    // Check if user has permission to update users
    if (!auth.permissions.has(['users:update'], scopes)) {
      throw new ForbiddenException('User does not have permission')
    }

    // Update user
    const updatedUser = await this.usersService.updateOneBy({ id }, request)

    // Return updated user response
    return toUserDetails(updatedUser)
  }
}
