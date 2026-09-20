/**
 * Returns the key for storing OTP in Redis for a given login
 * @param login Login of the user OTP is generated for
 * @returns Key for storing OTP in Redis
 */
export const OtpStorageKey = (login: string) => `otp:${login}`

/**
 * Returns the key for counting failed OTP guesses in Redis for a given login
 * @param login Login of the user the guesses are being counted for
 * @returns Key for storing the OTP attempt counter in Redis
 */
export const OtpAttemptsStorageKey = (login: string) => `otp:attempts:${login}`

/**
 * Type of the destination to send the OTP to.
 */
export enum OtpType {
  Email = 'email',
  Sms = 'sms',
}

export type OtpMethod = `${OtpType}`

export type Otp = {
  code: string
  type: OtpType
}
