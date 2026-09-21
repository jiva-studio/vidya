import { watch } from 'vue'

import { useCurrentSchool } from '@/shared/access'
import { usePagedList } from '@/shared/lib'

import { useRoleApi } from '../api'
import type { RoleRow } from './types'

/**
 * The roles of the current school, a page at a time.
 *
 * The rows are dropped before the request goes out, so no line of the previous
 * school survives the switch even for a frame.
 */
export const useRoles = () => {
  const api = useRoleApi()
  const { generation } = useCurrentSchool()

  const list = usePagedList<RoleRow>({ read: (page) => api.list(page) })

  watch(generation, () => {
    list.restart()
  })

  return list
}
