import { ref, watch } from 'vue'

import { useCurrentSchool } from '@/shared/access'
import { reasonOf } from '@/shared/lib'

import { useUserApi } from '../api'
import type { UserRow } from './types'

/**
 * The users of the current school, with the three states a list owes.
 *
 * `GetUsersQuery` takes a school, so the list is narrowed by the server rather
 * than filtered here, and the rows are dropped before every request.
 */
export const useUsers = () => {
  const api = useUserApi()
  const { generation } = useCurrentSchool()

  const rows = ref<UserRow[]>([])
  const loading = ref(false)
  const error = ref<string | undefined>(undefined)

  const load = async (): Promise<void> => {
    loading.value = true
    error.value = undefined
    rows.value = []

    try {
      const response = await api.list()
      rows.value = response.items
    } catch (failure) {
      error.value = reasonOf(failure)
    } finally {
      loading.value = false
    }
  }

  watch(generation, () => {
    void load()
  })

  return { rows, loading, error, load }
}
