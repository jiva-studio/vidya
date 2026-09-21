import { computed, ref, watch } from 'vue'

import { useCurrentSchool } from '@/shared/access'
import { reasonOf } from '@/shared/lib'

import { useUserApi } from '../api'
import type { UserRow } from './types'

/** As many people as read at once without scrolling past the search box. */
export const PAGE_SIZE = 25

/**
 * The people of the current school, a page at a time.
 *
 * The page and the search go to the server: a school with hundreds of people
 * would otherwise ship all of them to filter three out in the browser. A new
 * search returns to the first page, because page four of the old result is not
 * page four of the new one.
 */
export const useUsers = () => {
  const api = useUserApi()
  const { generation } = useCurrentSchool()

  const rows = ref<UserRow[]>([])
  const total = ref(0)
  const page = ref(1)
  const query = ref('')
  const loading = ref(false)
  const error = ref<string | undefined>(undefined)

  const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

  let ticket = 0

  const load = async (): Promise<void> => {
    const mine = ++ticket

    loading.value = true
    error.value = undefined
    rows.value = []

    try {
      const response = await api.list({
        limit: PAGE_SIZE,
        offset: (page.value - 1) * PAGE_SIZE,
        query: query.value.trim() || undefined,
      })

      if (mine !== ticket) return
      rows.value = response.items
      total.value = response.total
    } catch (failure) {
      if (mine !== ticket) return
      error.value = reasonOf(failure)
    } finally {
      if (mine === ticket) loading.value = false
    }
  }

  const goTo = (next: number): void => {
    page.value = next
    void load()
  }

  const find = (term: string): void => {
    query.value = term
    page.value = 1
    void load()
  }

  watch(generation, () => {
    page.value = 1
    void load()
  })

  return { rows, total, page, pages, query, loading, error, load, goTo, find }
}
