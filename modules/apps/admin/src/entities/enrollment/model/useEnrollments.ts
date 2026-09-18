import type { EnrollmentSummary } from '@vidya/protocol'
import { computed, ref, watch } from 'vue'

import { useCurrentSchool } from '@/shared/access'
import { reasonOf } from '@/shared/lib'

import { useEnrollmentApi } from '../api'
import { toEnrollmentRows } from './enrollmentRows'
import type { EnrollmentFilters, StudentNames } from './types'
import { useDirectory } from './useDirectory'
import { useEnrollmentLookup } from './useEnrollmentLookup'

/**
 * The requests waiting on the current school, ready to be shown.
 *
 * The list endpoint narrows by permission rather than by school, so the rows
 * are kept to the courses of the school in hand; without that, switching school
 * would leave another school's requests on screen (AC-6).
 *
 * Names are not the entity's to fetch — people live in another slice — so the
 * caller passes the cache in and the same one serves the whole page.
 */
export const useEnrollments = (students: StudentNames) => {
  const api = useEnrollmentApi()
  const lookup = useEnrollmentLookup()
  const directory = useDirectory()
  const { generation } = useCurrentSchool()

  const items = ref<EnrollmentSummary[]>([])
  const filters = ref<EnrollmentFilters>({})
  const loading = ref(false)
  const error = ref<string | undefined>(undefined)

  const rows = computed(() =>
    toEnrollmentRows(items.value, {
      details: lookup.details.value,
      names: students.names.value,
      courseNames: directory.courseNames.value,
      groupNames: directory.groupNames.value,
    }),
  )

  const resolveRows = async (found: EnrollmentSummary[]): Promise<void> => {
    await lookup.resolve(found.map((item) => item.id))

    const people = found.flatMap((item) => {
      const resolved = lookup.details.value.get(item.id)
      return [resolved?.studentId, resolved?.decidedById]
    })

    await students.resolve(people)
  }

  // The list endpoint answers with every school the operator may read, so a
  // request belonging to another school is dropped here. A directory that could
  // not be read narrows nothing, rather than emptying the screen.
  const inCurrentSchool = (item: EnrollmentSummary): boolean =>
    directory.courseNames.value.size === 0 || directory.courseNames.value.has(item.courseId)

  const load = async (): Promise<void> => {
    loading.value = true
    error.value = undefined
    items.value = []

    try {
      await directory.load()
      const response = await api.list({ ...filters.value })
      items.value = response.items.filter(inCurrentSchool)
      await resolveRows(items.value)
    } catch (failure) {
      error.value = reasonOf(failure)
    } finally {
      loading.value = false
    }
  }

  watch(generation, () => {
    void load()
  })

  return { rows, filters, loading, error, load, directory }
}
