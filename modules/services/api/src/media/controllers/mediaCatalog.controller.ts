import { Controller, ForbiddenException, Get, Query, UseFilters, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Authentication } from '@vidya/api/auth/decorators'
import { AuthenticatedUserGuard } from '@vidya/api/auth/guards'
import { UserAuthentication } from '@vidya/api/auth/utils'
import * as dto from '@vidya/api/media/dto'
import { MediaCatalogService } from '@vidya/api/media/services'
import * as protocol from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import { MediaRefusalFilter } from './mediaRefusal.filter'
import { StorageFailureFilter } from './storageFailure.filter'

/** The library one school browses; another school's files are never in it. */
@Controller()
@ApiTags('🗄 Media :: Catalog')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@UseFilters(StorageFailureFilter, MediaRefusalFilter)
export class MediaCatalogController {
  constructor(private readonly catalog: MediaCatalogService) {}

  @Get(Routes().media.find())
  @ApiOperation({ summary: 'List a school library', operationId: 'Media::find' })
  @ApiOkResponse()
  async getMany(
    @Query() query: dto.MediaQuery,
    @Authentication() auth: UserAuthentication,
  ): Promise<protocol.GetMediaResponse> {
    if (!auth.permissions.has(['media:read'], { schoolId: query.schoolId })) {
      throw new ForbiddenException('User does not have permission')
    }

    return this.catalog.findPage(query)
  }
}
