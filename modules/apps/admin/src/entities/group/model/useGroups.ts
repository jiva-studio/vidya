import type { GroupSummary } from '@vidya/protocol'
import { onMounted, ref, watch } from 'vue'

import { useCurrentSchool } from '@/shared/access'
import { useHttp } from '@/shared/api'
import { reasonOf } from '@/shared/lib'

import { getGroups } from '../api'

/**
 * The groups the operator may see, optionally narrowed to one course.
 *
 * The rows go before the request does, so a school change never leaves the
 * previous school's groups on screen (AC-6). The request carries no school:
 * `GetGroupsQuery` has no field for one and the server scopes by the grants in
 * the token.
 */
export const useGroups = () => {
  const http = useHttp()
  const { generation } = useCurrentSchool()

  const items = ref<GroupSummary[]>([])
  const courseId = ref<string>('')
  const loading = ref(false)
  const error = ref<string | undefined>(undefined)

  let ticket = 0

  const load = async (): Promise<void> => {
    const mine = ++ticket

    items.value = []
    loading.value = true
    error.value = undefined

    try {
      const response = await getGroups(http, { courseId: courseId.value || undefined })
      if (mine !== ticket) return
      items.value = response.items
    } catch (caught) {
      if (mine !== ticket) return
      error.value = reasonOf(caught, 'groups-load-failed')
    } finally {
      if (mine === ticket) loading.value = false
    }
  }

  watch([generation, courseId], () => {
    void load()
  })

  onMounted(() => {
    void load()
  })

  return { items, courseId, loading, error, reload: load }
}
