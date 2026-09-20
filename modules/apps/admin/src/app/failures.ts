import type { Failure } from '@/shared/api'
import { translate } from '@/shared/i18n'
import type { Toasts } from '@/shared/lib'

/**
 * A failed request, said once, where the application says everything else.
 *
 * The server's own reason goes underneath rather than instead: the line above
 * is what the operator can act on, the line below is what they can quote.
 *
 * A message already on screen is not said again. A screen that opens six lists
 * loses all six to one cut cable, and six identical notices are five more than
 * the operator can do anything with.
 */
export const announceFailure = (toasts: Toasts, failure: Failure): void => {
  const title = translate(failure.key)
  const said = toasts.items.value.some(
    (toast) => toast.title === title && toast.description === failure.reason,
  )

  if (said) return

  toasts.show({ title, description: failure.reason, tone: 'danger' })
}
