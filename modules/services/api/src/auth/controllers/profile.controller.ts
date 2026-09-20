import { Controller, Get, UnauthorizedException, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Authentication } from '@vidya/api/auth/decorators'
import * as dto from '@vidya/api/auth/dto'
import { AuthenticatedUserGuard } from '@vidya/api/auth/guards'
import { AuthUsersService } from '@vidya/api/auth/services'
import { UserAuthentication } from '@vidya/api/auth/utils'
import { Routes } from '@vidya/protocol'

/**
 * Who the caller is.
 *
 * Answered from the token and never from an identifier in the path: this is the
 * one endpoint whose whole subject is the holder, and taking the id from the
 * request would turn "my profile" into "anybody's profile".
 *
 * The device needs it before anything else. A session deliberately stores no
 * identity — the API scopes a student's own rows to whoever holds the token —
 * but every table on the device is keyed by owner, so the identity has to be
 * asked for once at sign-in, and this is the only place it can be asked.
 */
@Controller()
@ApiTags('🔐 Authentication')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
export class ProfileController {
  constructor(private readonly users: AuthUsersService) {}

  /* -------------------------------------------------------------------------- */
  /*                              GET /auth/profile                             */
  /* -------------------------------------------------------------------------- */

  @Get(Routes().auth.profile())
  @ApiOperation({
    summary: 'Returns the profile of the signed-in user',
    operationId: 'auth::profile',
    description:
      `Returns the identity behind the access token.\n\n` +
      `The device stores \`userId\` as the owner of every local row, so it is ` +
      `asked for once, at sign-in.`,
  })
  @ApiOkResponse({ type: dto.GetProfileResponse, description: 'The caller.' })
  async getProfile(@Authentication() auth: UserAuthentication): Promise<dto.GetProfileResponse> {
    const user = await this.users.findById(auth.userId)

    // The token verified, so the account it names existed when it was minted;
    // it being gone now is a deleted account, which is no longer a session.
    if (!user) {
      throw new UnauthorizedException()
    }

    // A name is absent until the person fills it in, and an address is absent
    // for someone who signed in by phone. Both travel as a missing key rather
    // than as an empty string, which the device reads as "ask for it".
    return new dto.GetProfileResponse({
      userId: user.id,
      email: user.email ?? undefined,
      name: user.name ?? undefined,
    })
  }
}
