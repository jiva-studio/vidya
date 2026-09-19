import type { CourseSummary } from '@vidya/protocol'
import { onMounted, ref, watch } from 'vue'

import { useCurrentSchool } from '@/shared/access'
import { useHttp } from '@/shared/api'
import { reasonOf } from '@/shared/lib'

import { getCourses } from '../api'

/**
 * The courses of the school the operator is working in.
 *
 * The rows are dropped before the request goes out rather than after it comes
 * back, so switching school never leaves the previous school's courses on
 * screen while the new ones load. A late answer to a superseded request
 * is discarded by its ticket.
 */
export const useCourses = () => {
  const http = useHttp()
  const { schoolId, generation } = useCurrentSchool()

  const items = ref<CourseSummary[]>([])
  const loading = ref(false)
  const error = ref<string | undefined>(undefined)

  let ticket = 0

  const load = async (): Promise<void> => {
    const mine = ++ticket

    items.value = []
    loading.value = true
    error.value = undefined

    try {
      const response = await getCourses(http, { schoolId: schoolId.value })
      if (mine !== ticket) return
      items.value = response.items
    } catch (caught) {
      if (mine !== ticket) return
      error.value = reasonOf(caught, 'courses-load-failed')
    } finally {
      if (mine === ticket) loading.value = false
    }
  }

  watch(generation, () => {
    void load()
  })

  onMounted(() => {
    void load()
  })

  return { items, loading, error, reload: load }
}
