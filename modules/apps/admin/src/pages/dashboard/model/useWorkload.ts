import type { SchoolId } from '@vidya/domain'
import { ref, watch } from 'vue'

import { useEnrollmentApi } from '@/entities/enrollment'
import { useHomeworkApi } from '@/entities/homework'
import { useCurrentSchool } from '@/shared/access'

import type { Workload } from './types'

/**
 * How much is waiting in each queue the home screen offers.
 *
 * Counted from the lists themselves: neither endpoint answers a count. Each is
 * narrowed to the school on screen, because both answer for every school the
 * token grants. One refusal does not take the other down, so a reviewer who
 * may read homework but not requests still gets their figure.
 */
export const useWorkload = () => {
  const enrollments = useEnrollmentApi()
  const homework = useHomeworkApi()
  const { schoolId, generation } = useCurrentSchool()

  const counts = ref<Workload>({})
  const loading = ref(false)

  let ticket = 0

  const countWaitingRequests = async (school: SchoolId): Promise<number | undefined> => {
    try {
      const { items } = await enrollments.list({ status: 'pending', schoolId: school })
      return items.length
    } catch {
      // Unreadable is not none; the card leaves its figure out.
      return undefined
    }
  }

  const countWaitingHomework = async (school: SchoolId): Promise<number | undefined> => {
    try {
      const { items } = await homework.list({ status: 'pending', schoolId: school })
      return items.length
    } catch {
      return undefined
    }
  }

  const load = async (): Promise<void> => {
    const mine = ++ticket
    const school = schoolId.value
    loading.value = true

    // A count over every school the token grants is not this school's workload.
    if (!school) {
      counts.value = {}
      loading.value = false
      return
    }

    const [waitingRequests, waitingHomework] = await Promise.all([
      countWaitingRequests(school),
      countWaitingHomework(school),
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
