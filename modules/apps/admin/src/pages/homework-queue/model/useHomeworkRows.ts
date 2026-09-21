import type { EnrollmentId } from '@vidya/domain'
import { computed, watch } from 'vue'

import { useEnrollmentLookup, useStudentNames } from '@/entities/enrollment'
import type { WorkContext } from '@/entities/homework'
import { filterHomeworkRows, toHomeworkRows, useHomeworkQueue } from '@/entities/homework'
import { useUserApi } from '@/entities/user'
import { useDirectory } from '@/features/school-directory'
import { useCurrentSchool } from '@/shared/access'

/**
 * The list with everything a reader needs to make sense of it.
 *
 * Three slices meet here rather than inside any one of them: a work names an
 * enrolment, the enrolment names a student, and the student's name lives with
 * people. Each of those is read once and kept — thirty works by five students
 * cost five requests, not thirty — and nothing is asked for a second time.
 */
export const useHomeworkRows = () => {
  const queue = useHomeworkQueue()
  const lookup = useEnrollmentLookup()
  const directory = useDirectory()
  const users = useUserApi()
  const { generation } = useCurrentSchool()

  const students = useStudentNames(async (id) => (await users.nameOf(id)).name)

  const contextOf = (enrollmentId: EnrollmentId): WorkContext | undefined => {
    const resolved = lookup.details.value.get(enrollmentId)
    if (!resolved) return undefined

    return {
      studentId: resolved.studentId,
      studentName: students.names.value.get(resolved.studentId),
      courseId: resolved.courseId,
      groupId: resolved.groupId,
      courseName: directory.courseNames.value.get(resolved.courseId),
      groupName: resolved.groupId ? directory.groupNames.value.get(resolved.groupId) : undefined,
    }
  }

  const schoolCourses = computed(() => new Set(directory.courseNames.value.keys()))

  const rows = computed(() =>
    filterHomeworkRows(
      toHomeworkRows(queue.items.value, contextOf),
      queue.filters.value,
      schoolCourses.value,
    ),
  )

  const resolve = async (): Promise<void> => {
    await lookup.resolve(queue.items.value.map((item) => item.enrollmentId))
    const people = queue.items.value.map(
      (item) => lookup.details.value.get(item.enrollmentId)?.studentId,
    )
    await students.resolve(people)
  }

  const load = async (): Promise<void> => {
    await Promise.all([queue.load(), directory.load()])
    await resolve()
  }

  watch(generation, () => {
    void load()
  })

  return {
    rows,
    filters: queue.filters,
    loading: queue.loading,
    error: queue.error,
    load,
    total: queue.total,
    page: queue.page,
    paged: queue.paged,
    goTo: queue.goTo,
    restart: queue.restart,
    directory,
  }
}
