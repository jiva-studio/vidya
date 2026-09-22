import type { LocalLesson } from '@vidya/client'
import type { EnrollmentId } from '@vidya/domain'

import type { LocalEducation } from '@/shared/data'

import type { LessonRow } from '../types'
import { toLessonRow } from './toLessonRow'

export interface LessonProgressInput {
  readonly lessons: readonly LocalLesson[]

  /** The place whose progress is counted; null when the student holds none. */
  readonly enrollmentId: EnrollmentId | null

  readonly education: LocalEducation
}

/**
 * The lessons of a course, each with the student's progress on it.
 *
 * The lessons are listed whether or not the student holds a place: what a
 * course teaches is not a secret from somebody deciding whether to ask for
 * one. Progress is what is, and block states are written against a place — so
 * without a place there is nothing to count and nothing is counted.
 */
export const readLessonProgress = (input: LessonProgressInput): Promise<LessonRow[]> =>
  Promise.all(input.lessons.map((lesson) => readOne(lesson, input)))

const readOne = async (lesson: LocalLesson, input: LessonProgressInput): Promise<LessonRow> => {
  const { education, enrollmentId } = input
  const version = await education.lessonVersions.getPublished(lesson.id)
  if (version === null || enrollmentId === null) return toLessonRow(lesson, version, [])

  const states = await education.blockStates.listByLessonVersion(enrollmentId, version.id)

  return toLessonRow(lesson, version, states)
}
