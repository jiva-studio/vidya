import type { EnrollmentId, EnrollmentStatus, GroupId } from '@vidya/domain'
import { ref } from 'vue'

import { useEnrollmentApi } from '@/entities/enrollment'
import { reasonOf } from '@/shared/lib'

type Decision = Extract<EnrollmentStatus, 'accepted' | 'declined' | 'revoked'>

/**
 * Deciding a request from the row it is in, and giving back a place taken away.
 *
 * A request is decided once: the server answers a second decision with 409, so
 * a refusal is not offered back as an undo. Declining is put behind a
 * confirmation that names the consequence instead, which is the honest reading
 * of an action that cannot be taken back.
 *
 * `accept` carries the one reversal the server does allow — a place the school
 * took back, or the student handed back, returning to `accepted` — which is
 * why it needs no call of its own. It also carries the group, because a request
 * is answered and placed in one move: a decision that left the group for a
 * second request would put a student on the course before the school had
 * chosen where.
 */
export const useModerateEnrollment = () => {
  const api = useEnrollmentApi()

  const deciding = ref<EnrollmentId | undefined>(undefined)
  const error = ref<string | undefined>(undefined)

  const decide = async (
    id: EnrollmentId,
    status: Decision,
    groupId?: GroupId,
  ): Promise<boolean> => {
    deciding.value = id
    error.value = undefined

    try {
      await api.moderate(id, groupId ? { status, groupId } : { status })
      return true
    } catch (failure) {
      error.value = reasonOf(failure)
      return false
    } finally {
      deciding.value = undefined
    }
  }

  const accept = (id: EnrollmentId, groupId?: GroupId) => decide(id, 'accepted', groupId)
  const decline = (id: EnrollmentId) => decide(id, 'declined')

  // Taking back a place already given. Reversible: `accept` puts it back, which
  // is why expelling by mistake is a click and not a new request.
  const revoke = (id: EnrollmentId) => decide(id, 'revoked')

  // A refusal belongs to the decision that earned it, and a screen that opens
  // again is not the place the last one failed.
  const forget = () => {
    error.value = undefined
  }

  return { accept, decline, revoke, deciding, error, forget }
}
