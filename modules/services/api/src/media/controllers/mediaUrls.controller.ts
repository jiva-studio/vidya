import { Body, Controller, HttpCode, Post, UseFilters, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Authentication } from '@vidya/api/auth/decorators'
import { AuthenticatedUserGuard } from '@vidya/api/auth/guards'
import { UserAuthentication } from '@vidya/api/auth/utils'
import * as dto from '@vidya/api/media/dto'
import { MediaAddressesService, MediaReadAccessService } from '@vidya/api/media/services'
import * as protocol from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import { MediaRefusalFilter } from './mediaRefusal.filter'
import { StorageFailureFilter } from './storageFailure.filter'

/**
 * The addresses a screen needs before it draws, in one call.
 *
 * A file the caller may not read is left out of the answer rather than refused:
 * a screen asking for twelve must still draw the eleven it is entitled to, and
 * one stale reference in old content cannot be allowed to blank a lesson.
 * Absence is also the quieter answer — it says nothing about whether the file
 * exists, so another school's id and an id that never existed read alike.
 */
@Controller()
@ApiTags('🗄 Media :: Reading')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@UseFilters(StorageFailureFilter, MediaRefusalFilter)
export class MediaUrlsController {
  constructor(
    private readonly access: MediaReadAccessService,
    private readonly addresses: MediaAddressesService,
  ) {}

  @Post(Routes().media.urls())
  @HttpCode(200)
  @ApiOperation({ summary: 'Ask for playable addresses', operationId: 'Media::urls' })
  @ApiOkResponse()
  async resolveMany(
    @Body() request: dto.ResolveMediaRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<protocol.ResolveMediaResponse> {
    const readable = await this.access.findReadable(request.ids, auth)

    return { urls: await this.addresses.signAll(readable) }
  }
}
