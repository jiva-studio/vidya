import * as dto from '@vidya/api/edu/dto'
import * as domain from '@vidya/domain'
import * as entities from '@vidya/entities'

import { project, projectAll } from './project'

/* -------------------------------------------------------------------------- */
/*                                   Fields                                   */
/* -------------------------------------------------------------------------- */

const COURSE = ['id', 'schoolId', 'name', 'description', 'learningType'] as const
const COURSE_SUMMARY = ['id', 'name', 'description'] as const

const GROUP = ['id', 'courseId', 'name', 'description'] as const
const GROUP_SUMMARY = ['id', 'name'] as const

const LESSON = ['id', 'courseId', 'lessonNumber', 'title'] as const
const LESSON_SUMMARY = ['id', 'lessonNumber', 'title'] as const

const VERSION = ['id', 'lessonId', 'version', 'status', 'publishedAt'] as const
const VERSION_DETAILS = [...VERSION, 'content'] as const

const ENROLLMENT = [
  'id',
  'courseId',
  'groupId',
  'studentId',
  'schoolId',
  'status',
  'decidedById',
  'decidedAt',
  'createdAt',
] as const
const ENROLLMENT_SUMMARY = ['id', 'courseId', 'groupId', 'status', 'createdAt'] as const

const HOMEWORK = [
  'id',
  'enrollmentId',
  'lessonVersionId',
  'sectionId',
  'schoolId',
  'status',
  'text',
  'grade',
  'reviewedById',
  'submittedAt',
  'reviewedAt',
  'answeredSupersededVersion',
] as const
const HOMEWORK_SUMMARY = [
  'id',
  'enrollmentId',
  'sectionId',
  'status',
  'grade',
  'submittedAt',
] as const

const BLOCK_STATE = [
  'id',
  'enrollmentId',
  'lessonVersionId',
  'blockId',
  'schoolId',
  'state',
  'updatedAt',
] as const

/* -------------------------------------------------------------------------- */
/*                                   Courses                                  */
/* -------------------------------------------------------------------------- */

export const toCourseDetails = (c: entities.Course) => project<dto.CourseDetails>(c, COURSE)
export const toCourseSummaries = (c: entities.Course[]) =>
  projectAll<dto.CourseSummary>(c, COURSE_SUMMARY)
export const toCreatedId = <TId extends domain.Id<string>>(e: { id: TId }) => ({ id: e.id })

/* -------------------------------------------------------------------------- */
/*                                   Groups                                   */
/* -------------------------------------------------------------------------- */

export const toGroupDetails = (g: entities.Group) => project<dto.GroupDetails>(g, GROUP)
export const toGroupSummaries = (g: entities.Group[]) =>
  projectAll<dto.GroupSummary>(g, GROUP_SUMMARY)

/* -------------------------------------------------------------------------- */
/*                                   Lessons                                  */
/* -------------------------------------------------------------------------- */

export const toLessonDetails = (l: entities.Lesson) => project<dto.LessonDetails>(l, LESSON)
export const toLessonSummaries = (l: entities.Lesson[]) =>
  projectAll<dto.LessonSummary>(l, LESSON_SUMMARY)

export const toVersionSummary = (v: entities.LessonVersion) =>
  project<dto.LessonVersionSummary>(v, VERSION)
export const toVersionSummaries = (v: entities.LessonVersion[]) =>
  projectAll<dto.LessonVersionSummary>(v, VERSION)
export const toVersionDetails = (v: entities.LessonVersion) =>
  project<dto.LessonVersionDetails>(v, VERSION_DETAILS)

/* -------------------------------------------------------------------------- */
/*                                 Enrollments                                */
/* -------------------------------------------------------------------------- */

export const toEnrollmentDetails = (e: entities.Enrollment) =>
  project<dto.EnrollmentDetails>(e, ENROLLMENT)
export const toEnrollmentSummaries = (e: entities.Enrollment[]) =>
  projectAll<dto.EnrollmentSummary>(e, ENROLLMENT_SUMMARY)

/* -------------------------------------------------------------------------- */
/*                                  Homework                                  */
/* -------------------------------------------------------------------------- */

export const toHomeworkDetails = (h: entities.Homework) => project<dto.HomeworkDetails>(h, HOMEWORK)
export const toHomeworkSummaries = (h: entities.Homework[]) =>
  projectAll<dto.HomeworkSummary>(h, HOMEWORK_SUMMARY)

export const toBlockStateDetails = (b: entities.BlockState) =>
  project<dto.BlockStateDetails>(b, BLOCK_STATE)
export const toBlockStateDetailsList = (b: entities.BlockState[]) =>
  projectAll<dto.BlockStateDetails>(b, BLOCK_STATE)
