import type {
  LocalCourse,
  LocalHomework,
  LocalLesson,
  LocalLessonVersion,
  LocalSchool,
} from '@vidya/client'

import type { HomeworkCard } from '../types'

export interface HomeworkCardsInput {
  readonly answers: readonly LocalHomework[]
  readonly versions: readonly LocalLessonVersion[]
  readonly lessons: readonly LocalLesson[]
  readonly courses: readonly LocalCourse[]
  readonly schools: readonly LocalSchool[]
}

const findLesson = (input: HomeworkCardsInput, answer: LocalHomework): LocalLesson | null => {
  const version = input.versions.find((held) => held.id === answer.lessonVersionId)
  if (version === undefined) return null

  return input.lessons.find((held) => held.id === version.lessonId) ?? null
}

const findCourse = (input: HomeworkCardsInput, lesson: LocalLesson | null): LocalCourse | null => {
  if (lesson === null) return null

  return input.courses.find((held) => held.id === lesson.courseId) ?? null
}

const toCard = (input: HomeworkCardsInput, answer: LocalHomework): HomeworkCard => {
  const lesson = findLesson(input, answer)
  const course = findCourse(input, lesson)
  const school = input.schools.find((held) => held.id === answer.schoolId)

  return {
    answer,
    schoolId: answer.schoolId,
    schoolCode: school === undefined ? null : school.code,
    courseName: course === null ? null : course.name,
    courseId: lesson === null ? null : lesson.courseId,
    lessonId: lesson === null ? null : lesson.id,
    lessonTitle: lesson === null ? null : lesson.title,
  }
}

/**
 * Every answer the student has written, newest first, with whatever this
 * machine knows about the lesson it was written on.
 *
 * Newest first because the list is a place to pick work up again, and the
 * answer just handed in or just come back is the one being looked for.
 */
export const toHomeworkCards = (input: HomeworkCardsInput): HomeworkCard[] =>
  [...input.answers]
    .sort((one, other) => other.createdAt.localeCompare(one.createdAt))
    .map((answer) => toCard(input, answer))
