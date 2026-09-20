import { Inject, Injectable } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { OtpConfig } from '@vidya/api/configs'
import { RedisService } from '@vidya/api/shared/services'
import { Otp, OtpAttemptsStorageKey, OtpStorageKey, OtpType } from '@vidya/protocol'
import { randomInt } from 'crypto'

/**
 * Service for generating and validating one-time passwords (OTPs) using Redis.
 */
@Injectable()
export class OtpService {
  // The code's lifetime and the guess budget's lifetime are the same window:
  // a budget that outlives the code it guards would go on rejecting requests
  // for a code that is already gone, which is not what it is there to bound.
  private static readonly ttlSeconds = 300
  private static readonly maxAttempts = 5

  /**
   * Constructs an instance of the OTP service.
   *
   * @param redisConfig - The configuration for connecting to the Redis server.
   */
  constructor(
    private readonly redis: RedisService,
    @Inject(OtpConfig.KEY)
    private readonly otpConfig: ConfigType<typeof OtpConfig>,
  ) {}

  /**
   * Generates a one-time password for the given login and type.
   *
   * @param login - The login identifier for which the OTP is being generated.
   * @param type - The type or method of OTP generation (e.g., SMS, email).
   * @returns A promise that resolves to the generated OTP code as a string.
   */
  async generate(login: string, type: OtpType): Promise<Otp> {
    const otp: Otp = {
      code: this.generateCode(),
      type: type,
    }
    await this.redis.set(OtpStorageKey(login), JSON.stringify(otp), OtpService.ttlSeconds)
    return otp
  }

  /**
   * Checks if the one-time password for the given login has expired.
   *
   * @param login - The login identifier for which to check the OTP expiration.
   * @returns A promise that resolves to a boolean indicating whether the OTP has expired.
   */
  async isExpired(login: string): Promise<boolean> {
    const key = OtpStorageKey(login)
    return !(await this.redis.exists(key))
  }

  /**
   * Validates the provided OTP code for the given login.
   *
   * @param login - The login identifier for which the OTP code is being validated.
   * @param code - The OTP code to validate.
   * @returns A promise that resolves to the Otp object if the code is
   *          correct, or undefined if the code is incorrect, exhausted or
   *          not found.
   *
   * @remarks
   * The OTP code is expired immediately upon successful validation to
   * prevent replay attacks and multiple logins. A wrong guess is counted
   * against the login, and the code is burned once the guess budget runs out
   * — a six-digit numeric code is small enough to brute-force otherwise.
   *
   * The counter is keyed off the raw login string, same as the code itself.
   * Logins are not normalised anywhere yet, so `Bob@x.com` and `bob@x.com`
   * count separately; once a separate change normalises the login on the way
   * in, this counter inherits that for free, because it shares the same key.
   */
  async validate(login: string, code: string): Promise<Otp | undefined> {
    const key = OtpStorageKey(login)
    const attemptsKey = OtpAttemptsStorageKey(login)
    const stored: Otp = JSON.parse(await this.redis.get(key))
    if (!stored) return undefined

    if (code === stored.code) {
      await this.redis.del(key)
      await this.redis.del(attemptsKey)
      return stored
    }

    const attempts = await this.redis.incr(attemptsKey, OtpService.ttlSeconds)
    if (attempts >= OtpService.maxAttempts) {
      // Burn the code so the exhausted budget cannot be told apart from a
      // wrong code or an expired one: every case returns undefined here and
      // becomes the same 401 downstream. A distinct outcome would tell a
      // caller whether this login has a code live at all.
      await this.redis.del(key)
      await this.redis.del(attemptsKey)
    }

    return undefined
  }

  /**
   * Generates a random OTP  code based on the configured
   * alphabet and length.
   *
   * @returns A randomly generated OTP code.
   */
  private generateCode(): string {
    const characters = this.otpConfig.alphabet
    const length = this.otpConfig.length
    let result = ''
    for (let i = 0; i < length; i++) {
      // randomInt is CSPRNG-backed; a predictable OTP is not a second factor.
      result += characters.charAt(randomInt(characters.length))
    }
    return result
  }
}
