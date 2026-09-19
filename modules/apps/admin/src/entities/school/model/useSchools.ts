import { ref, watch } from 'vue'

import { useCurrentSchool } from '@/shared/access'
import { reasonOf } from '@/shared/lib'

import { useSchoolApi } from '../api'
import type { SchoolRow } from './types'

/**
 * The schools the operator may see, with the three states a list owes.
 *
 * The rows are dropped before the request goes out, so the screen never shows
 * a school from the set the previous token or the previous choice produced.
 */
export const useSchools = () => {
  const api = useSchoolApi()
  const { generation } = useCurrentSchool()

  const rows = ref<SchoolRow[]>([])
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

  // Changing school changes what the server will answer, so the list is asked
  // again rather than kept.
  watch(generation, () => {
    void load()
  })

  return { rows, loading, error, load }
}
