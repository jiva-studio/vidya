import { toastController } from '@ionic/vue'
import { useFluent } from 'fluent-vue'

/** How long a message stays up. Long enough to read twice, short enough to leave. */
const VISIBLE_MS = 4_000

/**
 * What the sign-in screens say when something goes wrong.
 *
 * A toast rather than a line in the form, because a line has to be given room:
 * either the room is always there — an empty strip on every screen for the
 * message that usually does not come — or the form changes height at the exact
 * moment the finger is already travelling towards the button. A toast occupies
 * no space at all and moves nothing.
 */
export function useAuthToast() {
  const fluent = useFluent()

  const show = async (message: string, tone: 'danger' | 'medium' = 'danger'): Promise<void> => {
    const toast = await toastController.create({
      message: fluent.$t(message),
      color: tone,
      duration: VISIBLE_MS,
      // Top, not bottom: the controls a thumb reaches for live at the bottom
      // of the screen, and a message about a tap that failed must not cover
      // the button the next tap needs.
      position: 'top',
    })

    await toast.present()
  }

  return { show }
}
