import type { LocalCourse, LocalEnrollment } from '@vidya/client'
import { asId, type CourseId } from '@vidya/domain'
import { computed } from 'vue'

import { useLocalEducation, useLocalRead, useLocalSchools } from '@/shared/data'

import type { LessonRow } from '../types'
import { readLessonProgress } from './readLessonProgress'
import { resolveCourse } from './resolveCourse'

interface CourseScreen {
  readonly course: LocalCourse | null
  readonly lessons: readonly LessonRow[]
  readonly place: LocalEnrollment | null
}

const NOTHING: CourseScreen = { course: null, lessons: [], place: null }

/**
 * One course: what it teaches, and where the student stands on it.
 *
 * The place is read beside the course because the two answer one question —
 * whether this is a course to ask for or a course to get on with — and reading
 * them apart would let the screen offer a place the student already holds.
 */
export const useCourseView = (code: () => string, courseId: () => string) => {
  const schools = useLocalSchools()
  const education = useLocalEducation()

  const { data, reading } = useLocalRead(
    async (): Promise<CourseScreen> => {
      const school = await schools.getByCode(code())
      const found = resolveCourse(
        await education.courses.getById(asId<CourseId>(courseId())),
        school,
      )

      if (found === null) return NOTHING

      const place = await education.enrollments.getLiveByCourse(found.id)
      const lessons = await readLessonProgress({
        lessons: await education.lessons.listByCourse(found.id),
        enrollmentId: place?.id ?? null,
        education,
      })

      return { course: found, lessons, place }
    },
    NOTHING,
    [code, courseId],
  )

  return {
    course: computed(() => data.value.course),
    lessons: computed(() => data.value.lessons),
    place: computed(() => data.value.place),
    reading,
  }
}
