import {
  Body,
  Controller,
  ForbiddenException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiConflictResponse, ApiTags } from '@nestjs/swagger'
import { Authentication } from '@vidya/api/auth/decorators'
import { AuthenticatedUserGuard } from '@vidya/api/auth/guards'
import { UserAuthentication } from '@vidya/api/auth/utils'
import * as dto from '@vidya/api/edu/dto'
import { UserSchoolsService } from '@vidya/api/edu/services'
import { CrudDecorators } from '@vidya/api/shared/decorators'
import * as domain from '@vidya/domain'
import { Routes } from '@vidya/protocol'

import { UserExistsPipe } from '../../pipes'

// TODO: relabel the generated Swagger operations for this resource.
const Crud = CrudDecorators({
  entityName: 'UserSchools',
  getManyResponseDto: dto.GetUserSchoolsListResponse,
  updateOneResponseDto: dto.AddUserSchoolsResponse,
  deleteOneResponseDto: dto.LeaveSchoolResponse,
})

@Controller()
@ApiTags('🧝 Education :: Users')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
export class UserSchoolsController {
  constructor(private readonly userSchoolsService: UserSchoolsService) {}

  /* -------------------------------------------------------------------------- */
  /*                        GET /edu/users/:userId/schools                      */
  /* -------------------------------------------------------------------------- */

  @Crud.GetMany(Routes().edu.user(':userId').schools.all())
  async getAll(
    @Param('userId', new ParseUUIDPipe()) userId: domain.UserId,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.GetUserSchoolsListResponse> {
    // Check if the user has permission to read the schools
    const schoolIds = await this.userSchoolsService.getUserSchools(userId)
    const scope = schoolIds.map((id) => ({ schoolId: id }))
    if (!auth.permissions.has(['users:read'], scope)) {
      throw new ForbiddenException('User does not have permission')
    }

    // Return the list of school ids
    return new dto.GetUserSchoolsListResponse(schoolIds)
  }

  /* -------------------------------------------------------------------------- */
  /*                        POST /edu/users/:userId/schools                     */
  /* -------------------------------------------------------------------------- */

  @Crud.CreateOne(Routes().edu.user(':userId').schools.create())
  async set(
    @Param('userId', new ParseUUIDPipe(), UserExistsPipe) userId: domain.UserId,
    @Body() request: dto.AddUserSchoolsRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.AddUserSchoolsResponse> {
    if (auth.userId !== userId) {
      throw new ForbiddenException('User does not have permission')
    }
    await this.userSchoolsService.addUser(userId, request.schoolId)
    return new dto.AddUserSchoolsResponse({ success: true })
  }

  /* -------------------------------------------------------------------------- */
  /*                 DELETE /edu/users/:userId/schools/:schoolId                */
  /* -------------------------------------------------------------------------- */

  /**
   * Leaving a school, for oneself only.
   *
   * Leaving is leaving its courses: the role is what grants them, and taking
   * the role back revokes every live place it carried. The count goes out with
   * the answer so a screen can say what it cost — the places are already gone
   * by the time the caller reads it, which is why a confirmation belongs
   * before the call and not after.
   *
   * An owner does not leave this way: another owner takes the owner role away
   * first, or the school is left with nobody who can administer it.
   */
  @ApiConflictResponse({ description: 'An owner of the school cannot leave it' })
  @Crud.DeleteOne(Routes().edu.user(':userId').schools.delete(':schoolId'))
  async leave(
    @Param('userId', new ParseUUIDPipe(), UserExistsPipe) userId: domain.UserId,
    @Param('schoolId', new ParseUUIDPipe()) schoolId: domain.SchoolId,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.LeaveSchoolResponse> {
    if (auth.userId !== userId) {
      throw new ForbiddenException('User does not have permission')
    }

    const revokedPlaces = await this.userSchoolsService.removeUser(userId, schoolId, auth.userId)

    return new dto.LeaveSchoolResponse({ revokedPlaces })
  }
}
