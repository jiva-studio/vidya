import type { EnrollmentId } from '@vidya/domain'
import { ref } from 'vue'

import { useEnrollmentApi } from '../api'
import type { EnrollmentDetailsById } from './types'

/**
 * The half of an enrolment the list endpoint leaves out.
 *
 * `EnrollmentSummary` is a projection without `studentId`, `decidedById` and
 * `decidedAt`, so a queue that says who is asking and who decided has to read
 * each enrolment once. Read once is the whole point of the cache: a work list
 * pointing at the same enrolment thirty times costs one request.
 */
export const useEnrollmentLookup = () => {
  const api = useEnrollmentApi()

  const details = ref<EnrollmentDetailsById>(new Map())
  const asked = new Set<EnrollmentId>()

  const read = async (id: EnrollmentId): Promise<void> => {
    try {
      const found = await api.get(id)
      details.value.set(id, {
        studentId: found.studentId,
        decidedById: found.decidedById,
        decidedAt: found.decidedAt,
        courseId: found.courseId,
        groupId: found.groupId,
      })
    } catch {
      // One unreadable enrolment leaves its row without a name, not the page without rows.
      asked.add(id)
    }
  }

  const resolve = async (ids: EnrollmentId[]): Promise<void> => {
    const wanted = [...new Set(ids)].filter((id) => !asked.has(id))
    if (wanted.length === 0) return

    wanted.forEach((id) => asked.add(id))
    await Promise.all(wanted.map(read))
    details.value = new Map(details.value)
  }

  return { details, resolve }
}
