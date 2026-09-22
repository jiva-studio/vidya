import { HttpError, OfflineError } from '@vidya/client'
import { ref } from 'vue'

import { useHttp } from '@/shared/api'
import { useConnection } from '@/shared/connection'

import { readOwnerId, requestCode, signInWithCode } from '../api'
import type { OtpStep } from '../types'
import { CODE_LIFETIME_SECONDS, useResendCountdown } from './useResendCountdown'

const reasonFor = (error: unknown): string => {
  if (error instanceof OfflineError) return 'auth-error-offline'
  if (error instanceof HttpError && error.status === 401) return 'auth-error-wrong-code'
  return 'auth-error-failed'
}

/** The server refused because a code it already sent is still alive. */
const isTooManyRequests = (error: unknown): boolean =>
  error instanceof HttpError && error.status === 429

/**
 * The two steps of signing in, and what the screen shows between them.
 *
 * The tokens land in the connection the sync engine reads, not in a session of
 * the screens' own: two of those would mean a site that considers itself
 * signed in while nothing is being synchronised.
 *
 * A wrong code leaves the field as it was: the student mistyped one digit of
 * eight, and clearing the box makes them read the email again for no reason.
 */
export const useOtpSignIn = () => {
  const http = useHttp()
  const connection = useConnection()
  const countdown = useResendCountdown()

  const step = ref<OtpStep>('email')
  const email = ref('')
  const code = ref('')
  const busy = ref(false)
  const error = ref<string | undefined>(undefined)

  const send = async () => {
    if (busy.value || email.value.trim().length === 0) return
    busy.value = true
    error.value = undefined

    try {
      await requestCode(http, email.value.trim())
      countdown.start(CODE_LIFETIME_SECONDS)
      step.value = 'code'
    } catch (caught) {
      // A refusal because the last code is still alive is not a failure: the
      // student has the code already, so the screen moves on and waits.
      if (isTooManyRequests(caught)) {
        countdown.start(CODE_LIFETIME_SECONDS)
        step.value = 'code'
        error.value = 'auth-error-code-still-valid'
      } else {
        error.value = reasonFor(caught)
      }
    } finally {
      busy.value = false
    }
  }

  const submit = async (): Promise<boolean> => {
    if (busy.value || code.value.trim().length === 0) return false
    busy.value = true
    error.value = undefined

    try {
      const tokens = await signInWithCode(http, email.value.trim(), code.value.trim())

      // Offered first so the next request carries them, and only then made a
      // connection: what makes it one is the identity the server answers with.
      connection.offer(tokens)
      connection.signIn(await readOwnerId(http))

      countdown.stop()
      return true
    } catch (caught) {
      error.value = reasonFor(caught)
      return false
    } finally {
      busy.value = false
    }
  }

  return { step, email, code, busy, error, countdown, send, submit }
}
