import { ApiProperty } from '@nestjs/swagger'
import { normalizeLogin } from '@vidya/api/auth/utils'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import { Transform } from 'class-transformer'
import { IsEmail, IsNotEmpty, IsString } from 'class-validator'

/* -------------------------------------------------------------------------- */
/*                                Authentcation                               */
/* -------------------------------------------------------------------------- */

export class OtpSignInRequest implements protocol.OtpSignInRequest {
  @ApiProperty({ example: 'example@example.com' })
  // Normalised the same way as GetOtpRequest.destination, so the Redis OTP
  // key, the attempt counter and the user lookup all see the same string
  // regardless of how the caller capitalised or padded their login.
  @Transform(({ value }) => normalizeLogin(value))
  // Every login is an email address today; add a phone validator here when
  // sms sign-in ships.
  @IsEmail()
  login: string

  @ApiProperty({ example: '123123' })
  @IsString()
  @IsNotEmpty()
  otp: string
}

export class OtpSignInResponse implements protocol.OtpSignInResponse {
  constructor(options: { accessToken: string; refreshToken: string }) {
    this.accessToken = options.accessToken
    this.refreshToken = options.refreshToken
  }

  @ApiProperty({ example: 'token' })
  @IsString()
  accessToken: string

  @ApiProperty({ example: 'token' })
  @IsString()
  refreshToken: string
}

export class RefreshTokensRequest implements protocol.RefreshTokensRequest {
  @ApiProperty({ example: 'refreshToken' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string
}

export class SignOutRequest implements protocol.SignOutRequest {
  @ApiProperty({ example: 'refreshToken' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string
}

export class SignOutResponse implements protocol.SignOutResponse {}

/* -------------------------------------------------------------------------- */
/*                                   Tokens                                   */
/* -------------------------------------------------------------------------- */

export class RefreshTokensResponse implements protocol.RefreshTokensResponse {
  constructor(options: { accessToken: string; refreshToken: string }) {
    this.accessToken = options.accessToken
    this.refreshToken = options.refreshToken
  }

  @ApiProperty({ example: 'accessToken' })
  @IsString()
  @IsNotEmpty()
  accessToken: string

  @ApiProperty({ example: 'refreshToken' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string
}

export class UserPermission implements protocol.UserPermission {
  @ApiProperty({ example: 'schoolId' })
  sid: domain.SchoolId

  @ApiProperty({ example: ['permissions'] })
  p: domain.PermissionKey[]
}
