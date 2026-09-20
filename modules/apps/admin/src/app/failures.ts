import type { Failure } from '@/shared/api'
import { translate } from '@/shared/i18n'
import type { Toasts } from '@/shared/lib'

/**
 * A failed request, said once, in the one place the application says things.
 *
 * The server's own reason goes underneath rather than instead: the line above
 * says what did not happen, which the operator can act on, and the line below
 * says what the server called it, which they can quote.
 */
export const announceFailure = (toasts: Toasts, failure: Failure): void => {
  toasts.show({
    title: translate(failure.key),
    description: failure.reason,
    tone: 'danger',
  })
}
