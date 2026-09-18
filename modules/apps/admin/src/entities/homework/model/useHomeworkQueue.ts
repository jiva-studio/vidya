import type { HomeworkSummary } from '@vidya/protocol'
import { ref } from 'vue'

import { reasonOf } from '@/shared/lib'

import { useHomeworkApi } from '../api'
import type { HomeworkFilters } from './types'

/**
 * The works waiting for a decision.
 *
 * Only the status travels to the server; course and group are applied to the
 * rows once their enrolments have been resolved, because the controller reads
 * neither. The queue opens on what is waiting rather than on everything ever
 * submitted: a reviewer sitting down to work wants the first of those.
 *
 * A row is unreadable until its enrolment and its student have been resolved,
 * so reloading belongs to whoever composes those — `useQueueRows` — and the
 * school is watched there rather than twice.
 */
export const useHomeworkQueue = () => {
  const api = useHomeworkApi()

  const items = ref<HomeworkSummary[]>([])
  const filters = ref<HomeworkFilters>({ status: 'pending' })
  const loading = ref(false)
  const error = ref<string | undefined>(undefined)

  const load = async (): Promise<void> => {
    loading.value = true
    error.value = undefined
    items.value = []

    try {
      const response = await api.list({ status: filters.value.status })
      items.value = response.items
    } catch (failure) {
      error.value = reasonOf(failure)
    } finally {
      loading.value = false
    }
  }

  return { items, filters, loading, error, load }
}
