import { registerAs } from '@nestjs/config'

// 8 digits over this alphabet is 10^8 codes — a hundredfold increase over the
// previous 6 digits — so a 300-second-lived code stays out of reach of a
// brute-force guesser even if a rate limiter is ever down or misconfigured.
export default registerAs('otp', () => ({
  alphabet: process.env.VIDYA_OTP_ALPHABET || '0123456789',
  length: parseInt(process.env.VIDYA_OTP_LENGTH, 10) || 8,
}))
