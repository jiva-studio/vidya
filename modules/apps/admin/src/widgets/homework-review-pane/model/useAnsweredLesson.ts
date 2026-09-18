import type { CourseId, LessonId, LessonVersionId } from '@vidya/domain'
import { ref } from 'vue'

import { getLessons, getLessonVersions } from '@/entities/lesson'
import { useHttp } from '@/shared/api'

/**
 * Which lesson holds the version a student answered.
 *
 * A piece of work names the version and nothing else, and a version can only be
 * read through its lesson (`GET /edu/lessons/:lessonId/versions/:id`), so the
 * lesson has to be found. The course comes from the enrolment, and its lessons
 * are walked until the version turns up; everything seen on the way is kept, so
 * a reviewer working through a queue of one course pays for this once.
 *
 * A failure leaves the notice without its link rather than the screen without
 * its work: knowing which version was answered is worth more than opening it.
 */
export const useAnsweredLesson = () => {
  const http = useHttp()

  const lessonId = ref<LessonId | undefined>(undefined)
  const lessonOfVersion = new Map<LessonVersionId, LessonId>()

  const walk = async (courseId: CourseId, versionId: LessonVersionId): Promise<void> => {
    const { items } = await getLessons(http, { courseId })

    for (const lesson of items) {
      const versions = await getLessonVersions(http, lesson.id)
      for (const version of versions.items) lessonOfVersion.set(version.id, lesson.id)
      if (lessonOfVersion.has(versionId)) return
    }
  }

  const resolve = async (courseId?: CourseId, versionId?: LessonVersionId): Promise<void> => {
    lessonId.value = undefined
    if (!courseId || !versionId) return

    if (!lessonOfVersion.has(versionId)) {
      try {
        await walk(courseId, versionId)
      } catch {
        return
      }
    }

    lessonId.value = lessonOfVersion.get(versionId)
  }

  return { lessonId, resolve }
}
