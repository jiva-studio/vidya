import { alertController } from '@ionic/vue'
import type { IEnrollmentRepository } from '@vidya/client'
import type { EnrollmentId } from '@vidya/domain'
import { useFluent } from 'fluent-vue'

import { useToast } from '@/shared'

import type { EnrollmentAction, EnrollmentActionView } from '../model/enrollmentActions'

/**
 * The three things a student can do to their own request, wherever they do it.
 *
 * The screens differ in how they ask — a row asks through a controller, a page
 * asks through the alert its layout already carries — but what happens after
 * the answer is one behaviour, and a second copy of it would be a second set
 * of rules about what reaches the school.
 */
export function useEnrollmentActions(
  enrollments: IEnrollmentRepository,
  reload: () => Promise<void>,
) {
  const fluent = useFluent()
  const toast = useToast()

  /**
   * The stamp is written and journaled on the swipe, not when the toast ends:
   * an application closed inside the window finds the row put away, and undo
   * is the mirror write rather than a cancellation of a row that may have gone.
   */
  const remove = async (id: EnrollmentId): Promise<void> => {
    await enrollments.archive(id)
    await reload()

    const outcome = await toast.action(fluent.$t('enrollment-removed'), {
      actionLabel: fluent.$t('enrollment-removed-undo'),
    })
    if (outcome !== 'pressed') return

    await enrollments.unarchive(id)
    await reload()
  }

  const handBack = async (id: EnrollmentId): Promise<void> => {
    await enrollments.withdraw(id)
    await reload()
  }

  const CARRY_OUT: Readonly<Record<EnrollmentAction, (id: EnrollmentId) => Promise<void>>> =
    Object.freeze({ cancel: handBack, leave: handBack, remove })

  const run = (id: EnrollmentId, action: EnrollmentActionView): Promise<void> =>
    CARRY_OUT[action.action](id)

  const ask = async (action: EnrollmentActionView): Promise<boolean> => {
    if (!action.confirmation) return true

    const alert = await alertController.create({
      header: fluent.$t(action.label),
      message: fluent.$t(action.confirmation),
      buttons: [
        { text: fluent.$t('no'), role: 'cancel' },
        { text: fluent.$t('yes'), role: 'confirm' },
      ],
    })

    await alert.present()
    const { role } = await alert.onDidDismiss()

    return role === 'confirm'
  }

  const confirmAndRun = async (id: EnrollmentId, action: EnrollmentActionView): Promise<void> => {
    if (await ask(action)) await run(id, action)
  }

  return { run, confirmAndRun }
}
