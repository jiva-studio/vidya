import type { EnrollmentId } from '@vidya/domain'
import { ref } from 'vue'

import { useEnrollmentApi } from '@/entities/enrollment'
import { reasonOf } from '@/shared/lib'

/**
 * The school putting an answered request out of its own sight.
 *
 * Each side tidies its own list: the row the school is done with is still the
 * student's answer to where their course went, so nothing here touches what the
 * student sees. There is no way back from this screen either — the row leaves
 * the list and the list is the only place it was — which is why the action is
 * asked for twice before it is sent.
 */
export const useArchiveEnrollment = () => {
  const api = useEnrollmentApi()

  const archiving = ref<EnrollmentId | undefined>(undefined)
  const error = ref<string | undefined>(undefined)

  const archive = async (id: EnrollmentId): Promise<boolean> => {
    archiving.value = id
    error.value = undefined

    try {
      await api.archive(id)
      return true
    } catch (failure) {
      error.value = reasonOf(failure)
      return false
    } finally {
      archiving.value = undefined
    }
  }

  return { archive, archiving, error }
}
