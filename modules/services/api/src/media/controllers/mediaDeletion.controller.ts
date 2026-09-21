import {
  Controller,
  Delete,
  ForbiddenException,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  UseFilters,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { Authentication } from '@vidya/api/auth/decorators'
import { AuthenticatedUserGuard } from '@vidya/api/auth/guards'
import { UserAuthentication } from '@vidya/api/auth/utils'
import { MediaDeletionService } from '@vidya/api/media/services'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import { MediaRefusalFilter } from './mediaRefusal.filter'
import { StorageFailureFilter } from './storageFailure.filter'

/** Taking a file out of a library, which a lesson that shows it may refuse. */
@Controller()
@ApiTags('🗄 Media :: Catalog')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@UseFilters(StorageFailureFilter, MediaRefusalFilter)
export class MediaDeletionController {
  constructor(private readonly deletion: MediaDeletionService) {}

  @Delete(Routes().media.delete(':id'))
  @ApiOperation({ summary: 'Delete a file from a library', operationId: 'Media::del' })
  @ApiOkResponse()
  @ApiConflictResponse({ description: 'The file is still used by a lesson version' })
  async deleteOne(
    @Param('id', new ParseUUIDPipe()) id: domain.MediaId,
    @Authentication() auth: UserAuthentication,
  ): Promise<protocol.DeleteMediaResponse> {
    const media = await this.deletion.findMedia(id)
    if (!media) throw new NotFoundException(`Media with id ${id} not found`)

    if (!auth.permissions.has(['media:delete'], { schoolId: media.schoolId })) {
      throw new ForbiddenException('User does not have permission')
    }

    await this.deletion.deleteMedia(media, auth.userId)

    return { success: true }
  }
}
