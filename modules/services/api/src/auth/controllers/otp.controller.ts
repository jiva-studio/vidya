import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  NotImplementedException,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger'
import { MailerService } from '@nestjs-modules/mailer'
import * as dto from '@vidya/api/auth/dto'
import { OtpService } from '@vidya/api/auth/services'
import { normalizeLogin } from '@vidya/api/auth/utils'
import { MailerConfig, throttlerSettings } from '@vidya/api/configs'
import { KeyedThrottlerGuard } from '@vidya/api/shared/throttling'
import { Routes } from '@vidya/protocol'

/**
 * Keyed by the normalised destination *and* by IP — see
 * `user-authentication.controller.ts` for why both. This is the limit that
 * actually closes the OTP brute force: `otp.service.ts` burns a code after
 * five wrong guesses, but deletes the guess counter along with it, so
 * without a cap on how often a *new* code can be requested, the attacker
 * just asks for another one and gets a fresh budget of five. Three new
 * codes an hour caps the whole attack at fifteen guesses an hour per
 * destination, not fifteen a minute.
 */
const otpThrottle = throttlerSettings().otp
const OTP_THROTTLE = KeyedThrottlerGuard([
  {
    name: 'auth:otp:destination',
    limit: otpThrottle.destinationLimit,
    windowMs: otpThrottle.windowMs,
    value: (req) => normalizeLogin(req.body?.destination) as string | undefined,
  },
  {
    name: 'auth:otp:ip',
    limit: otpThrottle.ipLimit,
    windowMs: otpThrottle.windowMs,
    value: (req) => req.ip,
  },
])

@Controller()
@ApiTags('🎟️ Authentication :: One-Time Password')
export class OtpController {
  constructor(
    private readonly otpService: OtpService,
    private readonly mailService: MailerService,
    @Inject(MailerConfig.KEY)
    private readonly mailerConfig: ConfigType<typeof MailerConfig>,
  ) {}

  /* -------------------------------------------------------------------------- */
  /*                               POST /auth/otp                               */
  /* -------------------------------------------------------------------------- */

  @Post(Routes().otp.root())
  @UseGuards(OTP_THROTTLE)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Generates OTP and sends it to the user',
    operationId: 'otp::generate',
    description:
      `Generates OTP and sends it to the user.\n\n` +
      `Returns success message if the OTP has been sent. If the OTP has ` +
      `already been generated and is still valid, returns an error message.`,
  })
  @ApiBody({ type: dto.GetOtpRequest })
  @ApiOkResponse({
    type: dto.GetOtpResponse,
    description: 'OTP has been sent to the user.',
  })
  @ApiTooManyRequestsResponse({
    type: dto.ErrorResponse,
    description: 'An OTP has already been generated and is still valid.',
  })
  async generateOtpCode(@Body() request: dto.GetOtpRequest): Promise<dto.GetOtpResponse> {
    // Refused before a code is minted: generating one first would rate-limit the
    // caller for five minutes over a message this service cannot send.
    if (request.type !== 'email') {
      throw new NotImplementedException(`Cannot send an OTP over ${request.type} yet`)
    }

    // check if an OTP has already been generated and is still valid
    const isExpired = await this.otpService.isExpired(request.destination)
    if (!isExpired) {
      throw new HttpException(
        new dto.GetOtpResponse({
          success: false,
          message: 'An OTP has already been generated and is still valid.',
        }),
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    // generate a new OTP
    const otp = await this.otpService.generate(request.destination, request.type)

    // TODO: pick the template by the user's language, and resolve its images.
    const lang = 'en'

    await this.mailService.sendMail({
      from: {
        name: this.mailerConfig.from.name,
        address: this.mailerConfig.from.address,
      },
      to: request.destination,
      subject: 'Your OTP', // TODO: get from school config
      template: `${lang}/otp`,
      context: {
        code: otp.code,
        brandName: this.mailerConfig.from.name,
        supportEmail: this.mailerConfig.from.address,
        ttlMinutes: 5,
        currentYear: new Date().getFullYear(),
      },
    })

    return new dto.GetOtpResponse()
  }
}
