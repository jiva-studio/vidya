import { toastController } from '@ionic/vue'

/** How the student answered a toast that offered something to press. */
export type ToastOutcome = 'pressed' | 'expired' | 'dismissed'

export interface ToastOptions {
  durationMs?: number
  position?: 'top' | 'bottom'
}

export interface ActionToastOptions extends ToastOptions {
  actionLabel: string
}

/** Long enough to read and reach, short enough not to sit over the list. */
const VISIBLE_MS = 5_000

const UNDO_ROLE = 'action'

/**
 * Toasts are presented one at a time, across every screen.
 *
 * A toast that offers a way back owns a window the student is inside, and the
 * next one would close that window by taking its place: two rows put away a
 * second apart would leave only the second one recoverable. So a toast waits
 * for the one before it to be answered, and the queue is the module's rather
 * than a caller's, because two screens are two callers of the same strip of
 * screen.
 */
let queue: Promise<unknown> = Promise.resolve()

function enqueue<T>(present: () => Promise<T>): Promise<T> {
  const next = queue.then(present, present)
  queue = next.then(
    () => undefined,
    () => undefined,
  )

  return next
}

const outcomeOf = (role: string | undefined): ToastOutcome => {
  if (role === UNDO_ROLE) return 'pressed'

  return role === 'timeout' ? 'expired' : 'dismissed'
}

export function useToast() {
  /** Says something and waits its turn; nothing to answer and nothing to read back. */
  const show = (message: string, options: ToastOptions = {}): Promise<void> =>
    enqueue(async () => {
      const toast = await toastController.create({
        message,
        duration: options.durationMs ?? VISIBLE_MS,
        position: options.position ?? 'bottom',
      })

      await toast.present()
      await toast.onDidDismiss()
    })

  /** Offers one thing to press, and answers with what became of the offer. */
  const action = (message: string, options: ActionToastOptions): Promise<ToastOutcome> =>
    enqueue(async () => {
      const toast = await toastController.create({
        message,
        duration: options.durationMs ?? VISIBLE_MS,
        position: options.position ?? 'bottom',
        buttons: [{ text: options.actionLabel, role: UNDO_ROLE }],
      })

      await toast.present()
      const { role } = await toast.onDidDismiss()

      return outcomeOf(role)
    })

  return { show, action }
}
