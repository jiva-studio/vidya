import { Inject, Injectable } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { JwtConfig } from '@vidya/api/configs'
import * as domain from '@vidya/domain'
import { RefreshToken, TokenKind, UserPermission } from '@vidya/protocol'
import { v4 as uuidv4 } from 'uuid'

export type Tokens = {
  accessToken: string
  refreshToken: string
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(JwtConfig.KEY)
    private readonly jwtConfig: ConfigType<typeof JwtConfig>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Generates access and refresh tokens for the user.
   * @param userId User ID
   * @param permissions Permissions to save in the token (optional)
   * @returns Access and refresh tokens
   */
  /**
   * Permissions are not optional: every path that mints a token carries them,
   * and a token without them is one the guard has to go to the database for.
   * Required here so a new caller cannot quietly reintroduce that.
   */
  async generateTokens(userId: domain.UserId, permissions: UserPermission[]): Promise<Tokens> {
    const accessToken = await this.jwtService.signAsync(
      {
        jti: uuidv4(),
        sub: userId,
        typ: 'access' satisfies TokenKind,
        permissions,
      },
      {
        expiresIn: this.jwtConfig.accessTokenExpiresIn,
        secret: this.jwtConfig.secret,
      },
    )
    const refreshToken = await this.jwtService.signAsync(
      {
        jti: uuidv4(),
        sub: userId,
        typ: 'refresh' satisfies TokenKind,
      },
      {
        expiresIn: this.jwtConfig.refreshTokenExpiresIn,
        secret: this.jwtConfig.secret,
      },
    )

    return {
      accessToken,
      refreshToken,
    }
  }

  /**
   * Verifies a token of the given kind and returns its payload.
   *
   * The kind is checked here rather than by the caller, so that forgetting to
   * check is not something a caller can do.
   */
  async verifyToken(token: string, kind: TokenKind): Promise<RefreshToken | undefined> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshToken>(token, {
        secret: this.jwtConfig.secret,
      })

      return payload.typ === kind ? payload : undefined
    } catch {
      return undefined
    }
  }
}
