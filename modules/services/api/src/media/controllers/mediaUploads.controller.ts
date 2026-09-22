import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { Authentication } from '@vidya/api/auth/decorators'
import { AuthenticatedUserGuard } from '@vidya/api/auth/guards'
import { UserAuthentication } from '@vidya/api/auth/utils'
import * as dto from '@vidya/api/media/dto'
import { MediaUploadsService } from '@vidya/api/media/services'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import { MediaRefusalFilter } from './mediaRefusal.filter'
import { StorageFailureFilter } from './storageFailure.filter'

/**
 * The two calls an upload is driven through, and neither carries a file.
 *
 * The bytes go from the browser straight into the school's bucket by
 * signature: a route that accepted a body would put our process in front of
 * every upload and bill us for traffic that never needed to reach us.
 */
@Controller()
@ApiTags('🗄 Media :: Uploads')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@UseFilters(StorageFailureFilter, MediaRefusalFilter)
export class MediaUploadsController {
  constructor(private readonly uploads: MediaUploadsService) {}

  @Post(Routes().media.uploads())
  @ApiOperation({ summary: 'Ask for permission to upload a file', operationId: 'Media::sign' })
  @ApiCreatedResponse()
  async createOne(
    @Body() request: dto.CreateUploadRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<protocol.CreateUploadResponse> {
    this.assertMayUpload(auth, request.schoolId)

    return this.uploads.signUpload(request, auth.userId)
  }

  @Post(Routes().media.complete(':id'))
  @HttpCode(200)
  @ApiOperation({ summary: 'Say that the bytes have landed', operationId: 'Media::complete' })
  @ApiOkResponse()
  async completeOne(
    @Param('id', new ParseUUIDPipe()) id: domain.MediaId,
    @Body() request: dto.CompleteUploadRequest,
    @Authentication() auth: UserAuthentication,
  ): Promise<protocol.CompleteUploadResponse> {
    const media = await this.uploads.findMedia(id)
    if (!media) throw new NotFoundException(`Media with id ${id} not found`)

    this.assertMayUpload(auth, media.schoolId)

    return this.uploads.completeUpload(media, request.sha256)
  }

  private assertMayUpload(auth: UserAuthentication, schoolId: domain.SchoolId): void {
    if (!auth.permissions.has(['media:upload'], { schoolId })) {
      throw new ForbiddenException('User does not have permission')
    }
  }
}
