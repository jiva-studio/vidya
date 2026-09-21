import { alertController, toastController } from '@ionic/vue'
import { vi } from 'vitest'

/**
 * The two overlays a lifecycle screen puts up, staged so a test can answer them.
 *
 * Ionic builds both of them through a controller rather than through the
 * template, and an overlay that is never presented answers nobody: the screen
 * waits on the promise, and the assertion after it waits forever. So the
 * controllers are replaced by doubles that hand the test the same two answers a
 * finger gives — the action was pressed, or the window closed on its own.
 */

/** One toast the screen put up, and the two ways it can end. */
export interface StagedToast {
  message: string

  /** The label on the only button a toast of this kind carries. */
  actionLabel: string

  /** The student pressed it inside the window. */
  press(): Promise<void>

  /** The window closed with nobody pressing anything. */
  expire(): Promise<void>
}

/** One confirmation, and the two answers to it. */
export interface StagedAlert {
  header: string
  message: string
  confirm(): Promise<void>
  cancel(): Promise<void>
}

export interface StagedOverlays {
  /** Every toast presented so far, oldest first. */
  toasts: StagedToast[]

  /** Every confirmation presented so far, oldest first. */
  alerts: StagedAlert[]

  /**
   * Closes whatever is still open, as leaving the screen would.
   *
   * A queue that holds the next toast back until this one is answered is a
   * queue that a test leaving one unanswered hands to the test after it. So a
   * test ends with nothing open, the same way a screen does.
   */
  closeAll(): Promise<void>
}

interface OverlayButton {
  text?: string
  role?: string
  handler?: () => unknown
}

const asButtons = (buttons: unknown): OverlayButton[] =>
  Array.isArray(buttons)
    ? buttons.map((button) => (typeof button === 'string' ? { text: button } : (button ?? {})))
    : []

const textOf = (value: unknown): string => (value === undefined ? '' : String(value))

/** Lets the handlers a dismissal starts run before the test looks. */
const turn = async (): Promise<void> => {
  for (let index = 0; index < 5; index += 1) await new Promise((resolve) => setTimeout(resolve, 0))
}

export function stageOverlays(): StagedOverlays {
  const open: (() => void)[] = []

  const staged: StagedOverlays = {
    toasts: [],
    alerts: [],
    closeAll: async () => {
      // Closing one releases the queue, which may put up the next: keep going
      // until nothing more appears, or the test after this one inherits it.
      for (let round = 0; round < 10 && open.length > 0; round += 1) {
        open.splice(0).forEach((close) => close())
        await turn()
      }
    },
  }

  vi.spyOn(toastController, 'create').mockImplementation(async (options = {}) => {
    let close: (detail: { role?: string }) => void = () => undefined
    const dismissed = new Promise<{ role?: string }>((resolve) => {
      close = resolve
    })

    const [button] = asButtons(options.buttons)
    open.push(() => close({ role: 'timeout' }))

    staged.toasts.push({
      message: textOf(options.message),
      actionLabel: textOf(button?.text),
      press: async () => {
        await button?.handler?.()
        close({ role: button?.role ?? 'pressed' })
        await turn()
      },
      expire: async () => {
        close({ role: 'timeout' })
        await turn()
      },
    })

    return {
      present: async () => undefined,
      dismiss: async () => {
        close({ role: 'cancel' })
        return true
      },
      onDidDismiss: () => dismissed,
    } as never
  })

  vi.spyOn(alertController, 'create').mockImplementation(async (options = {}) => {
    let close: (detail: { role?: string }) => void = () => undefined
    const dismissed = new Promise<{ role?: string }>((resolve) => {
      close = resolve
    })

    const buttons = asButtons(options.buttons)
    open.push(() => close({ role: 'cancel' }))

    const pick = (role: string) =>
      buttons.find((button) => button.role === role) ??
      (role === 'confirm' ? buttons[buttons.length - 1] : buttons[0])

    const answer = async (role: string) => {
      const button = pick(role)
      await button?.handler?.()
      close({ role: button?.role ?? role })
      await turn()
    }

    staged.alerts.push({
      header: textOf(options.header),
      message: textOf(options.message),
      confirm: () => answer('confirm'),
      cancel: () => answer('cancel'),
    })

    return {
      present: async () => undefined,
      dismiss: async () => {
        close({ role: 'cancel' })
        return true
      },
      onDidDismiss: () => dismissed,
    } as never
  })

  return staged
}
