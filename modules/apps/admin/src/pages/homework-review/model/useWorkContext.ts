import type { HomeworkDetails } from '@vidya/protocol'
import type { Ref } from 'vue'
import { computed, watch } from 'vue'

import { useEnrollmentLookup, useStudentNames } from '@/entities/enrollment'
import { useUserApi } from '@/entities/user'
import { useDirectory } from '@/features/school-directory'

import type { ReviewWorkContext } from './types'
import { useAnsweredLesson } from './useAnsweredLesson'

/**
 * Who handed the open work in, and what it belongs to.
 *
 * `HomeworkDetails` names an enrolment, a lesson version and nothing else, so
 * the student, the course, the group and the lesson are each read through one
 * of the caches the list already uses. Names are read once per person and per
 * school; a name that cannot be read leaves a line blank rather than the screen
 * empty, because `users:read` is a separate right from reviewing.
 */
export const useWorkContext = (work: Ref<HomeworkDetails | undefined>) => {
  const lookup = useEnrollmentLookup()
  const directory = useDirectory()
  const users = useUserApi()
  const people = useStudentNames(async (id) => (await users.nameOf(id)).name)
  const lesson = useAnsweredLesson()

  const enrolment = computed(() =>
    work.value ? lookup.details.value.get(work.value.enrollmentId) : undefined,
  )

  const context = computed<ReviewWorkContext>(() => ({
    studentName: enrolment.value && people.names.value.get(enrolment.value.studentId),
    courseName: enrolment.value && directory.courseNames.value.get(enrolment.value.courseId),
    groupName: enrolment.value?.groupId
      ? directory.groupNames.value.get(enrolment.value.groupId)
      : undefined,
    reviewerName: work.value?.reviewedById
      ? people.names.value.get(work.value.reviewedById)
      : undefined,
    lessonId: lesson.lessonId.value,
    lessonTitle: lesson.lessonTitle.value,
  }))

  const resolve = async (): Promise<void> => {
    const opened = work.value
    if (!opened) return

    await Promise.all([directory.load(), lookup.resolve([opened.enrollmentId])])
    await people.resolve([enrolment.value?.studentId, opened.reviewedById])
    await lesson.resolve(enrolment.value?.courseId, opened.lessonVersionId)
  }

  watch(work, () => {
    void resolve()
  })

  return { context }
}
