import type { EnrollmentId, HomeworkId } from '@vidya/domain'
import { computed, watch } from 'vue'

import { useDirectory, useEnrollmentLookup, useStudentNames } from '@/entities/enrollment'
import type { WorkContext } from '@/entities/homework'
import { filterHomeworkRows, toHomeworkRows, useHomeworkQueue } from '@/entities/homework'
import { useUserApi } from '@/entities/user'
import { useCurrentSchool } from '@/shared/access'

/**
 * The queue with everything a reviewer needs to read it.
 *
 * Three slices meet here rather than inside any one of them: a work names an
 * enrolment, the enrolment names a student, and the student's name lives with
 * people. Each of those is read once and kept — thirty works by five students
 * cost five requests, not thirty — and nothing is asked for a second time.
 */
export const useQueueRows = () => {
  const queue = useHomeworkQueue()
  const lookup = useEnrollmentLookup()
  const directory = useDirectory()
  const users = useUserApi()
  const { generation } = useCurrentSchool()

  const students = useStudentNames(async (id) => (await users.get(id)).name)

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

  // A decided work leaves the queue where it stands, and the reviewer carries on
  // with the next one rather than being sent back to the list to find it.
  const nextAfter = (id: HomeworkId): HomeworkId | undefined => {
    const at = rows.value.findIndex((row) => row.id === id)
    const next = rows.value[at + 1] ?? rows.value[at - 1]
    return next?.id
  }

  const remove = (id: HomeworkId): void => {
    queue.items.value = queue.items.value.filter((item) => item.id !== id)
  }

  return {
    rows,
    filters: queue.filters,
    loading: queue.loading,
    error: queue.error,
    load,
    directory,
    nextAfter,
    remove,
  }
}
