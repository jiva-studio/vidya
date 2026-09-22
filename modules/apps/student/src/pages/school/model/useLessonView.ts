import type {
  LocalBlockState,
  LocalEnrollment,
  LocalHomework,
  LocalLesson,
  LocalLessonVersion,
} from '@vidya/client'
import { asId, type CourseId, type LessonId } from '@vidya/domain'
import { computed } from 'vue'

import { useLocalEducation, useLocalRead, useLocalSchools } from '@/shared/data'

import { resolveCourse } from './resolveCourse'
import { resolveLesson } from './resolveLesson'

interface LessonScreen {
  readonly lesson: LocalLesson | null
  readonly version: LocalLessonVersion | null
  readonly place: LocalEnrollment | null
  readonly states: readonly LocalBlockState[]
  readonly answers: readonly LocalHomework[]
}

const NOTHING: LessonScreen = {
  lesson: null,
  version: null,
  place: null,
  states: [],
  answers: [],
}

/**
 * One lesson: what it teaches, and what this student has done on it.
 *
 * The place is read beside the lesson because progress is recorded against a
 * place: without one there is nothing to record and nothing recorded, and the
 * lesson is still shown — what a course teaches is not a secret from somebody
 * deciding whether to ask for a place on it.
 */
export const useLessonView = (
  code: () => string,
  courseId: () => string,
  lessonId: () => string,
) => {
  const schools = useLocalSchools()
  const education = useLocalEducation()

  const { data, reading, reload } = useLocalRead(
    async (): Promise<LessonScreen> => {
      const school = await schools.getByCode(code())
      const course = resolveCourse(
        await education.courses.getById(asId<CourseId>(courseId())),
        school,
      )

      const lesson = resolveLesson(
        await education.lessons.getById(asId<LessonId>(lessonId())),
        course,
      )
      if (lesson === null) return NOTHING

      const version = await education.lessonVersions.getPublished(lesson.id)
      const place = await education.enrollments.getLiveByCourse(lesson.courseId)
      if (version === null || place === null) return { ...NOTHING, lesson, version, place }

      const states = await education.blockStates.listByLessonVersion(place.id, version.id)

      // Every answer of this place is read and then narrowed here: the device
      // keys homework by the version answered, and the port lists it by place.
      const answers = (await education.homework.listByEnrollment(place.id)).filter(
        (answer) => answer.lessonVersionId === version.id,
      )

      return { lesson, version, place, states, answers }
    },
    NOTHING,
    [code, courseId, lessonId],
  )

  return {
    lesson: computed(() => data.value.lesson),
    version: computed(() => data.value.version),
    place: computed(() => data.value.place),
    states: computed(() => data.value.states),
    answers: computed(() => data.value.answers),
    reading,
    reload,
  }
}
