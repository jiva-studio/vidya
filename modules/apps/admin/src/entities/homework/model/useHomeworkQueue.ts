import type { HomeworkSummary } from '@vidya/protocol'
import { computed, ref } from 'vue'

import { PAGE_SIZE, reasonOf } from '@/shared/lib'

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
  const total = ref(0)
  const page = ref(1)
  const filters = ref<HomeworkFilters>({ status: 'pending' })
  const loading = ref(false)
  const error = ref<string | undefined>(undefined)

  const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

  // Drawn only when there is a second page.
  const paged = computed(() => pages.value > 1)

  const load = async (): Promise<void> => {
    loading.value = true
    error.value = undefined
    items.value = []

    try {
      const response = await api.list({
        status: filters.value.status,
        limit: PAGE_SIZE,
        offset: (page.value - 1) * PAGE_SIZE,
      })
      items.value = response.items
      total.value = response.total
    } catch (failure) {
      error.value = reasonOf(failure)
    } finally {
      loading.value = false
    }
  }

  const goTo = (next: number): void => {
    page.value = next
    void load()
  }

  /** A new filter is a new queue, so it starts at its own first page. */
  const restart = (): void => {
    page.value = 1
    void load()
  }

  return { items, total, page, pages, paged, filters, loading, error, load, goTo, restart }
}
