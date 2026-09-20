import type { Failure } from '@/shared/api'
import { translate } from '@/shared/i18n'
import type { Toasts } from '@/shared/lib'

/**
 * A failed request, said once, where the application says everything else.
 *
 * The server's own reason goes underneath rather than instead: the line above
 * is what the operator can act on, the line below is what they can quote.
 */
export const announceFailure = (toasts: Toasts, failure: Failure): void => {
  toasts.show({
    title: translate(failure.key),
    description: failure.reason,
    tone: 'danger',
  })
}
