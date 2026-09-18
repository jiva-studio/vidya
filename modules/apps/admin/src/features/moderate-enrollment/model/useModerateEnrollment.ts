import type { EnrollmentId, EnrollmentStatus } from '@vidya/domain'
import { ref } from 'vue'

import { reason, useEnrollmentApi } from '@/entities/enrollment'

type Decision = Extract<EnrollmentStatus, 'accepted' | 'declined'>

/**
 * Accepting and declining a request, from the row it is in.
 *
 * A request is decided once: the server answers a second decision with 409, so
 * neither of these is offered back as an undo. Declining is put behind a
 * confirmation that names the consequence instead, which is the honest reading
 * of an action that cannot be taken back.
 */
export const useModerateEnrollment = () => {
  const api = useEnrollmentApi()

  const deciding = ref<EnrollmentId | undefined>(undefined)
  const error = ref<string | undefined>(undefined)

  const decide = async (id: EnrollmentId, status: Decision): Promise<boolean> => {
    deciding.value = id
    error.value = undefined

    try {
      await api.moderate(id, { status })
      return true
    } catch (failure) {
      error.value = reason(failure)
      return false
    } finally {
      deciding.value = undefined
    }
  }

  const accept = (id: EnrollmentId) => decide(id, 'accepted')
  const decline = (id: EnrollmentId) => decide(id, 'declined')

  return { accept, decline, deciding, error }
}
