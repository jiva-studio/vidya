import type { EnrollmentId, GroupId } from '@vidya/domain'
import { ref } from 'vue'

import { reason, useEnrollmentApi } from '@/entities/enrollment'

/**
 * Placing an accepted student in a group, and taking it back.
 *
 * This is the one decision on this screen that is reversible: the server
 * accepts the route again with the group the student had before, including no
 * group at all. So it is done at once and offered back, rather than asked about
 * first.
 */
export const useAssignGroup = () => {
  const api = useEnrollmentApi()

  const busy = ref(false)
  const error = ref<string | undefined>(undefined)

  const assign = async (id: EnrollmentId, groupId: GroupId | null): Promise<boolean> => {
    busy.value = true
    error.value = undefined

    try {
      await api.assignGroup(id, groupId)
      return true
    } catch (failure) {
      error.value = reason(failure)
      return false
    } finally {
      busy.value = false
    }
  }

  return { assign, busy, error }
}
