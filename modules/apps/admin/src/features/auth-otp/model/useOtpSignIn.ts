import { ref } from 'vue'

import { HttpError, isTooManyRequests, OfflineError, useHttp } from '@/shared/api'
import { useSession } from '@/shared/session'

import { requestCode, signInWithCode } from '../api'
import type { OtpStep } from '../types'
import { CODE_LIFETIME_SECONDS, useResendCountdown } from './useResendCountdown'

const reasonFor = (error: unknown): string => {
  if (error instanceof OfflineError) return 'auth-error-offline'
  if (error instanceof HttpError && error.status === 401) return 'auth-error-wrong-code'
  if (error instanceof HttpError && error.status === 429) return 'auth-error-too-many'
  if (error instanceof HttpError && error.reason) return error.reason
  return 'auth-error-failed'
}

/**
 * The two steps of signing in, and what the screen shows between them.
 *
 * A wrong code leaves the field as it was: the operator mistyped one digit of
 * eight, and clearing the box makes them read the email again for no reason.
 */
export const useOtpSignIn = () => {
  const http = useHttp()
  const session = useSession()
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
      // operator has the code already, so the screen moves on and waits.
      if (
        isTooManyRequests(caught) &&
        caught instanceof HttpError &&
        caught.reason?.includes('already been generated')
      ) {
        countdown.start(CODE_LIFETIME_SECONDS)
        step.value = 'code'
        error.value = undefined
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
      session.start(tokens)
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
