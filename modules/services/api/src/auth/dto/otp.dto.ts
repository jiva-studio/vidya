import { ApiProperty } from '@nestjs/swagger'
import { normalizeLogin } from '@vidya/api/auth/utils'
import * as protocol from '@vidya/protocol'
import { Transform } from 'class-transformer'
import { IsEmail, IsEnum, IsNotEmpty, ValidateIf } from 'class-validator'

export class GetOtpRequest implements protocol.GetOtpRequest {
  @ApiProperty({ enum: protocol.OtpType, example: 'email' })
  @IsEnum(protocol.OtpType)
  @IsNotEmpty()
  type: protocol.OtpType

  @ApiProperty({ example: 'example@example.com' })
  @Transform(({ value }) => normalizeLogin(value))
  // Only the email path is validated as an address; the sms path has no
  // validator yet, since it is not implemented. Add one here, conditional
  // the same way, once it ships.
  @ValidateIf((request) => request.type === protocol.OtpType.Email)
  @IsEmail()
  destination: string
}

export class GetOtpResponse implements protocol.GetOtpResponse {
  constructor(options?: { success?: boolean; message?: string }) {
    this.success = options?.success ?? true
    this.message = this.success ? 'OTP has been sent' : (options?.message ?? 'Failed to send OTP')
  }

  @ApiProperty({ example: true })
  success: boolean

  @ApiProperty({ example: 'message' })
  message: string
}
