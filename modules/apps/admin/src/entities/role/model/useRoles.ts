import { ref, watch } from 'vue'

import { useCurrentSchool } from '@/shared/access'
import { reasonOf } from '@/shared/lib'

import { useRoleApi } from '../api'
import type { RoleRow } from './types'

/**
 * The roles of the current school, with the three states a list owes.
 *
 * The rows are dropped before the request goes out, so no line of the previous
 * school survives the switch even for a frame.
 */
export const useRoles = () => {
  const api = useRoleApi()
  const { generation } = useCurrentSchool()

  const rows = ref<RoleRow[]>([])
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
