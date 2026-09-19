import type { CourseId, GroupId } from '@vidya/domain'
import type { SelectOption } from '@vidya/ui'
import { computed, ref } from 'vue'

import { getCourses } from '@/entities/course'
import { getGroups } from '@/entities/group'
import { useCurrentSchool } from '@/shared/access'
import { useHttp } from '@/shared/api'

/**
 * The courses and groups of the current school, by name.
 *
 * An enrolment and a piece of homework name their course and their group by
 * identifier only, so the screens that list them are unreadable without these
 * two reads. Both are read once per school rather than once per row, and a
 * failure leaves the identifiers on screen with the rest of the page working:
 * a name nobody could read is not a reason to hide a queue.
 *
 * It lives above the entities because it is two of them at once — a course and
 * a group — and an entity may not reach into its neighbour.
 */
export const useDirectory = () => {
  const http = useHttp()
  const { schoolId, generation } = useCurrentSchool()

  const courses = ref<{ id: CourseId; name: string }[]>([])
  const groups = ref<{ id: GroupId; name: string }[]>([])

  const courseNames = computed(() => new Map(courses.value.map((item) => [item.id, item.name])))
  const groupNames = computed(() => new Map(groups.value.map((item) => [item.id, item.name])))

  const toOptions = (items: { id: string; name: string }[]): SelectOption[] =>
    items.map((item) => ({ value: item.id, label: item.name }))

  const courseOptions = computed(() => toOptions(courses.value))
  const groupOptions = computed(() => toOptions(groups.value))

  // Narrowing a list does not change what the school teaches, so a screen that
  // reloads its rows on every filter still reads the directory once.
  const loadedFor = ref<number | undefined>(undefined)

  const load = async (): Promise<void> => {
    if (loadedFor.value === generation.value) return
    loadedFor.value = generation.value

    const [read, grouped] = await Promise.allSettled([
      getCourses(http, { schoolId: schoolId.value }),
      getGroups(http, {}),
    ])

    if (read.status === 'fulfilled') courses.value = read.value.items
    if (grouped.status === 'fulfilled') groups.value = grouped.value.items
  }

  return { courseNames, groupNames, courseOptions, groupOptions, load }
}
