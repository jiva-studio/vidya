import type { CourseId, GroupId } from '@vidya/domain'
import type { SelectOption } from '@vidya/ui'
import { computed, ref } from 'vue'

import { useCurrentSchool } from '@/shared/access'

import { useDirectoryApi } from '../api'

/**
 * The courses and groups the enrolment screens name and filter by.
 *
 * Both lists are read once per page rather than once per row; a failure leaves
 * the identifiers on screen and the rest of the page working, because a name
 * nobody could read is not a reason to hide a queue of requests.
 */
export const useDirectory = () => {
  const api = useDirectoryApi()
  const { generation } = useCurrentSchool()

  const courses = ref<{ id: CourseId; name: string }[]>([])
  const groups = ref<{ id: GroupId; name: string }[]>([])

  const courseNames = computed(() => new Map(courses.value.map((item) => [item.id, item.name])))
  const groupNames = computed(() => new Map(groups.value.map((item) => [item.id, item.name])))

  const toOptions = (items: { id: string; name: string }[]): SelectOption[] =>
    items.map((item) => ({ value: item.id, label: item.name }))

  const courseOptions = computed(() => toOptions(courses.value))
  const groupOptions = computed(() => toOptions(groups.value))

  // Narrowing the list does not change what the school teaches, so the two
  // directories are read once per school rather than once per request.
  const loadedFor = ref<number | undefined>(undefined)

  const load = async (): Promise<void> => {
    if (loadedFor.value === generation.value) return
    loadedFor.value = generation.value

    const [read, grouped] = await Promise.allSettled([api.courses(), api.groups()])

    if (read.status === 'fulfilled') courses.value = read.value.items
    if (grouped.status === 'fulfilled') groups.value = grouped.value.items
  }

  return { courseNames, groupNames, courseOptions, groupOptions, load }
}
