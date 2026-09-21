import { watch } from 'vue'

import { useCurrentSchool } from '@/shared/access'
import { usePagedList } from '@/shared/lib'

import { useSchoolApi } from '../api'
import type { SchoolRow } from './types'

/**
 * The schools the operator may see, a page at a time.
 *
 * The rows are dropped before the request goes out, so the screen never shows
 * a school from the set the previous token or the previous choice produced.
 */
export const useSchools = () => {
  const api = useSchoolApi()
  const { generation } = useCurrentSchool()

  const list = usePagedList<SchoolRow>({ read: (page) => api.list(page) })

  // Changing school changes what the server will answer, so the list is asked
  // again rather than kept.
  watch(generation, () => {
    list.restart()
  })

  return list
}
