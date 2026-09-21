import { ref, watch } from 'vue'

import { useEnrollmentApi } from '@/entities/enrollment'
import { useHomeworkApi } from '@/entities/homework'
import { useCurrentSchool } from '@/shared/access'

import type { Workload } from './types'

/**
 * How much is waiting in each queue the home screen offers.
 *
 * Counted from the lists themselves: neither endpoint answers a count, and a
 * pair of list requests is cheaper than the endpoint nobody has written. The
 * requests are made side by side and one refusal does not take the other down
 * — a reviewer who may read homework but not requests still gets their number,
 * and the card whose count is missing says so rather than showing a zero.
 *
 * Requests are narrowed to the current school here, as the list screen does:
 * the endpoint answers for every school the token grants.
 */
export const useWorkload = () => {
  const enrollments = useEnrollmentApi()
  const homework = useHomeworkApi()
  const { generation } = useCurrentSchool()

  const counts = ref<Workload>({})
  const loading = ref(false)

  let ticket = 0

  const countWaitingRequests = async (): Promise<number | undefined> => {
    try {
      const { items } = await enrollments.list({ status: 'pending' })
      return items.length
    } catch {
      // Unreadable is not none; the card leaves its figure out.
      return undefined
    }
  }

  const countWaitingHomework = async (): Promise<number | undefined> => {
    try {
      const { items } = await homework.list({ status: 'pending' })
      return items.length
    } catch {
      return undefined
    }
  }

  const load = async (): Promise<void> => {
    const mine = ++ticket
    loading.value = true

    const [waitingRequests, waitingHomework] = await Promise.all([
      countWaitingRequests(),
      countWaitingHomework(),
    ])

    if (mine !== ticket) return

    counts.value = { enrollments: waitingRequests, homework: waitingHomework }
    loading.value = false
  }

  watch(generation, () => {
    void load()
  })

  return { counts, loading, load }
}
