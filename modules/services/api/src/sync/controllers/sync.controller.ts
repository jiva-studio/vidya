import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { Authentication } from '@vidya/api/auth/decorators'
import { AuthenticatedUserGuard } from '@vidya/api/auth/guards'
import { UserAuthentication } from '@vidya/api/auth/utils'
import { Routes } from '@vidya/protocol'

import * as dto from '../dto'
import { SyncCursorsService, SyncPullService, SyncPushService } from '../services'

/**
 * The three endpoints a device speaks to.
 *
 * Transport only: the caller's identity comes from the token and everything
 * else is decided in the services, because none of these rules belong to HTTP.
 * A push in particular is answered row by row with `200`, never with a status
 * code describing the batch — a refusal is a state of one row and the rows
 * beside it were applied.
 */
@Controller()
@ApiTags('🔄 Sync')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
export class SyncController {
  constructor(
    private readonly pullService: SyncPullService,
    private readonly pushService: SyncPushService,
    private readonly cursors: SyncCursorsService,
  ) {}

  /* -------------------------------------------------------------------------- */
  /*                               POST /sync/pull                              */
  /* -------------------------------------------------------------------------- */

  @Post(Routes().sync.pull())
  @HttpCode(200)
  @ApiOperation({
    summary: 'Fetch the changes addressed to the caller since their per-scope positions',
    operationId: 'Sync::pull',
  })
  @ApiOkResponse({ type: dto.PullResponseDto, description: 'A page of the journal' })
  @ApiBadRequestResponse({ description: 'Too many scopes, or a position that is not a position' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async pull(
    @Body() request: dto.PullRequestDto,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.PullResponseDto> {
    return this.pullService.pull(auth.userId, request)
  }

  /* -------------------------------------------------------------------------- */
  /*                               POST /sync/push                              */
  /* -------------------------------------------------------------------------- */

  @Post(Routes().sync.push())
  @HttpCode(200)
  @ApiOperation({
    summary: 'Apply a batch of local changes, answering each row on its own',
    operationId: 'Sync::push',
  })
  @ApiOkResponse({ type: dto.PushResponseDto, description: 'One answer per pushed row' })
  @ApiBadRequestResponse({ description: 'More rows than the batch may carry' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async push(
    @Body() request: dto.PushRequestDto,
    @Authentication() auth: UserAuthentication,
  ): Promise<dto.PushResponseDto> {
    return this.pushService.push(auth.userId, request)
  }

  /* -------------------------------------------------------------------------- */
  /*                              POST /sync/cursor                             */
  /* -------------------------------------------------------------------------- */

  @Post(Routes().sync.cursor())
  @HttpCode(204)
  @ApiOperation({
    summary: 'Record how far this device has applied the journal',
    operationId: 'Sync::cursor',
  })
  @ApiNoContentResponse({ description: 'Recorded' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async cursor(
    @Body() request: dto.AckCursorRequestDto,
    @Authentication() auth: UserAuthentication,
  ): Promise<void> {
    await this.cursors.acknowledge(auth.userId, request.deviceId, request.ackedSeq)
  }
}
