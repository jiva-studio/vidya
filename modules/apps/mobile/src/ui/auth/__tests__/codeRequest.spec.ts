import { HttpError, OfflineError } from '@vidya/client'
import { describe, expect, it } from 'vitest'

import { outcomeOfCodeRequest } from '../model/codeRequest'

const OTP = '/auth/otp'

/**
 * The server refuses a second code while the first one is still alive, and it
 * refuses with 429.
 *
 * That refusal means the code was sent and is in the mailbox — the opposite of
 * what a failure means. Told as one, it sends a person to check a connection
 * that is working, away from the email that is already waiting for them.
 */
describe('a request for a code that came back refused', () => {
  it('reads 429 as a code already waiting, not as a failure', () => {
    const outcome = outcomeOfCodeRequest(new HttpError(429, OTP))

    expect(outcome.message).toBe('code-already-sent')
    expect(outcome.codeIsWaiting).toBe(true)
  })

  it('does not paint a code that was sent as an error', () => {
    expect(outcomeOfCodeRequest(new HttpError(429, OTP)).tone).toBe('medium')
  })

  it('reads a server that broke as the failure it is', () => {
    const outcome = outcomeOfCodeRequest(new HttpError(500, OTP))

    expect(outcome.message).toBe('could-not-send')
    expect(outcome.codeIsWaiting).toBe(false)
    expect(outcome.tone).toBe('danger')
  })

  it('reads a request that never left the device the same way', () => {
    const outcome = outcomeOfCodeRequest(new OfflineError(OTP))

    expect(outcome.message).toBe('could-not-send')
    expect(outcome.codeIsWaiting).toBe(false)
  })

  it('reads anything it has never seen as a failure rather than as success', () => {
    // A refusal nobody has classified must not be able to pass for "your code
    // is waiting" — that would send a person to look for an email that is not
    // coming.
    expect(outcomeOfCodeRequest(new Error('who knows')).codeIsWaiting).toBe(false)
  })
})
