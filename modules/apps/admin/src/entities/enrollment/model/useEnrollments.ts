import type { EnrollmentSummary } from '@vidya/protocol'
import { computed, ref, watch } from 'vue'

import { useCurrentSchool } from '@/shared/access'
import { PAGE_SIZE, reasonOf } from '@/shared/lib'

import { useEnrollmentApi } from '../api'
import { toEnrollmentRows } from './enrollmentRows'
import type { Directory, EnrollmentFilters, StudentNames } from './types'
import { useEnrollmentLookup } from './useEnrollmentLookup'

/**
 * The requests waiting on the current school, ready to be shown.
 *
 * The list endpoint narrows by permission rather than by school, so the rows
 * are kept to the courses of the school in hand; without that, switching school
 * would leave another school's requests on screen.
 *
 * Neither the names of people nor the names of courses are this entity's to
 * fetch — both live in other slices — so the caller passes them in and the same
 * two caches serve the whole page.
 */
export const useEnrollments = (students: StudentNames, directory: Directory) => {
  const api = useEnrollmentApi()
  const lookup = useEnrollmentLookup()
  const { generation } = useCurrentSchool()

  const items = ref<EnrollmentSummary[]>([])
  const total = ref(0)
  const page = ref(1)
  // The screen exists to answer requests, so it opens on the ones still
  // waiting; every other state is a record, and a record does not need doing.
  const filters = ref<EnrollmentFilters>({ status: 'pending' })
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
      const response = await api.list({
        ...filters.value,
        limit: PAGE_SIZE,
        offset: (page.value - 1) * PAGE_SIZE,
      })
      items.value = response.items.filter(inCurrentSchool)
      total.value = response.total
      await resolveRows(items.value)
    } catch (failure) {
      error.value = reasonOf(failure)
    } finally {
      loading.value = false
    }
  }

  const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

  // Drawn only when there is a second page.
  const paged = computed(() => pages.value > 1)

  const goTo = (next: number): void => {
    page.value = next
    void load()
  }

  /** A new filter is a new list, so it starts at its own first page. */
  const restart = (): void => {
    page.value = 1
    void load()
  }

  watch(generation, () => {
    page.value = 1
    void load()
  })

  return { rows, filters, total, page, pages, paged, loading, error, load, goTo, restart }
}
