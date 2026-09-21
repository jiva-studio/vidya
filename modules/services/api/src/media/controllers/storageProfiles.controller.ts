import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseFilters,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Authentication } from '@vidya/api/auth/decorators'
import { AuthenticatedUserGuard } from '@vidya/api/auth/guards'
import { UserAuthentication } from '@vidya/api/auth/utils'
import * as dto from '@vidya/api/media/dto'
import { StorageSetupService } from '@vidya/api/media/services'
import * as domain from '@vidya/domain'
import { Routes } from '@vidya/protocol'

import { StorageFailureFilter } from './storageFailure.filter'

/**
 * A school's storage credentials: entered, proved, read back without the
 * secret, and replaced rather than edited.
 */
@Controller()
@ApiTags('🗄 Media :: Storage')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@UseFilters(StorageFailureFilter)
export class StorageProfilesController {
  constructor(private readonly storage: StorageSetupService) {}

  @Get(Routes().edu.schools.storage.get(':schoolId'))
  @ApiOperation({ summary: 'Read a school storage profile', operationId: 'Storage::get' })
  @ApiOkResponse({ type: dto.StorageProfileResponse })
  async getOne(
    @Param('schoolId', new ParseUUIDPipe()) schoolId: domain.SchoolId,
    @Authentication() auth: UserAuthentication,
  ) {
    this.assertMay(auth, 'storage:read', schoolId)

    return new dto.StorageProfileResponse(await this.storage.findProfileView(schoolId))
  }

  @Get(Routes().edu.schools.storage.usage(':schoolId'))
  @ApiOperation({ summary: 'Read what a school occupies', operationId: 'Storage::usage' })
  async getUsage(
    @Param('schoolId', new ParseUUIDPipe()) schoolId: domain.SchoolId,
    @Authentication() auth: UserAuthentication,
  ) {
    this.assertMay(auth, 'storage:read', schoolId)

    return this.storage.readUsage(schoolId)
  }

  @Put(Routes().edu.schools.storage.update(':schoolId'))
  @ApiOperation({ summary: 'Hand a school new storage credentials', operationId: 'Storage::put' })
  @ApiOkResponse({ type: dto.StorageProfileResponse })
  async updateOne(
    @Param('schoolId', new ParseUUIDPipe()) schoolId: domain.SchoolId,
    @Body() request: dto.UpsertStorageProfileRequest,
    @Authentication() auth: UserAuthentication,
  ) {
    this.assertMay(auth, 'storage:update', schoolId)

    return new dto.StorageProfileResponse(await this.storage.configureProfile(schoolId, request))
  }

  @Post(Routes().edu.schools.storage.verify(':schoolId'))
  @HttpCode(200)
  @ApiOperation({ summary: 'Prove the stored credentials again', operationId: 'Storage::verify' })
  @ApiOkResponse({ type: dto.StorageProfileResponse })
  async verifyOne(
    @Param('schoolId', new ParseUUIDPipe()) schoolId: domain.SchoolId,
    @Authentication() auth: UserAuthentication,
  ) {
    this.assertMay(auth, 'storage:read', schoolId)

    return new dto.StorageProfileResponse(await this.storage.verifyProfile(schoolId))
  }

  @Delete(Routes().edu.schools.storage.delete(':schoolId'))
  @ApiOperation({ summary: 'Return a school to the default storage', operationId: 'Storage::del' })
  async deleteOne(
    @Param('schoolId', new ParseUUIDPipe()) schoolId: domain.SchoolId,
    @Authentication() auth: UserAuthentication,
  ) {
    this.assertMay(auth, 'storage:update', schoolId)
    await this.storage.retireProfile(schoolId)

    return { success: true }
  }

  private assertMay(
    auth: UserAuthentication,
    permission: domain.PermissionKey,
    schoolId: domain.SchoolId,
  ): void {
    if (!auth.permissions.has([permission], { schoolId })) {
      throw new ForbiddenException('User does not have permission')
    }
  }
}
