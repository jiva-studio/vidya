import type {
  BlockStateKey,
  HomeworkAnswerKey,
  IBlockStateRepository,
  ICourseRepository,
  IEnrollmentRepository,
  IGroupRepository,
  IHomeworkRepository,
  ILessonRepository,
  ILessonVersionRepository,
  ISchoolRepository,
  LocalBlockState,
  LocalCourse,
  LocalEnrollment,
  LocalGroup,
  LocalHomework,
  LocalLesson,
  LocalLessonVersion,
  LocalSchool,
} from '@vidya/client'
import { isLive, isRecruiting } from '@vidya/domain'

/**
 * The device the screens read, as rows and as the ports over them.
 *
 * The screens are supposed to read from the device and from nowhere else, so
 * the doubles here are the device: arrays behind the data ports, answering the
 * questions the SQL repositories answer and hiding what they hide.
 */

export interface LocalSeed {
  schools: LocalSchool[]
  courses: LocalCourse[]
  lessons: LocalLesson[]
  versions: LocalLessonVersion[]
  enrollments: LocalEnrollment[]
  groups: LocalGroup[]
  homework: LocalHomework[]
  blockStates: LocalBlockState[]
}

/** The ports the screens read the device through, gathered for one lookup. */
export interface LocalRepositories {
  schools: ISchoolRepository
  courses: ICourseRepository
  lessons: ILessonRepository
  lessonVersions: ILessonVersionRepository
  enrollments: IEnrollmentRepository
  groups: IGroupRepository
  homework: IHomeworkRepository
  blockStates: IBlockStateRepository
}

export function emptySeed(): LocalSeed {
  return {
    schools: [],
    courses: [],
    lessons: [],
    versions: [],
    enrollments: [],
    groups: [],
    homework: [],
    blockStates: [],
  }
}

export const seed: LocalSeed = emptySeed()

export const repositories = {} as LocalRepositories

const notWritten = (): never => {
  throw new Error('this double reads only; give the screen a repository that writes')
}

/**
 * Enrolments the way the SQL repository hands them over, method by method.
 *
 * The three readers answer different questions. `list` hides what the student
 * put away, and only that. `getLiveByCourse` hides nothing and looks for the
 * row that still holds a place, newest first when two of them do. `getById`
 * filters nothing: a row asked for by name is the one case the screens exist
 * to explain.
 */
const byCreatedAt = (direction: 'asc' | 'desc'): LocalEnrollment[] =>
  seed.enrollments
    .filter((item) => item.deletedAt === null)
    .sort((a, b) =>
      direction === 'asc'
        ? a.createdAt.localeCompare(b.createdAt)
        : b.createdAt.localeCompare(a.createdAt),
    )

/** Hidden once the student put a finished row away. No instant is compared. */
const visibleToStudent = (row: LocalEnrollment) =>
  !(row.archivedByStudentAt !== null && !isLive(row.status))

/** The rows that still hold a place, newest first. */
const listLive = () => byCreatedAt('desc').filter((item) => isLive(item.status))

export function buildRepositories(): LocalRepositories {
  return {
    schools: {
      // A fresh array per call, as a query is. Handing out the seed itself
      // would let a row pushed later appear inside an answer already given.
      list: async () => seed.schools.slice(),
      getById: async (id) => seed.schools.find((item) => item.id === id) ?? null,
    },

    courses: {
      list: async () => seed.courses.slice(),
      getById: async (id) => seed.courses.find((item) => item.id === id) ?? null,
    },

    lessons: {
      listByCourse: async (courseId) => seed.lessons.filter((item) => item.courseId === courseId),
      getById: async (id) => seed.lessons.find((item) => item.id === id) ?? null,
    },

    // The content sits in a JSON column, so a read parses it: two reads of the
    // same version answer with blocks that are equal and never identical.
    lessonVersions: {
      getById: async (id) => reread(seed.versions.find((item) => item.id === id) ?? null),
      getPublished: async (lessonId) =>
        reread(
          seed.versions
            .filter((item) => item.lessonId === lessonId && item.status === 'published')
            .sort((a, b) => b.version - a.version)[0] ?? null,
        ),
    },

    enrollments: {
      list: async () => byCreatedAt('asc').filter(visibleToStudent),
      getById: async (id) => seed.enrollments.find((item) => item.id === id) ?? null,
      getLiveByCourse: async (courseId) =>
        listLive().find((item) => item.courseId === courseId) ?? null,
      request: notWritten,
      withdraw: notWritten,
      archive: notWritten,
      unarchive: notWritten,
    },

    groups: {
      /**
       * The filter lives in the query, not in the component.
       *
       * Two screens read this list, and a predicate written into both of them
       * is two predicates that will one day disagree about which group is
       * still taking students.
       */
      listRecruitingByCourse: async (courseId) =>
        seed.groups.filter((item) => item.courseId === courseId && isRecruiting(item.status)),

      // Unfiltered on purpose: an accepted student's own group is shown
      // whatever its status, or the place they hold disappears the day
      // recruitment closes.
      getById: async (id) => seed.groups.find((item) => item.id === id) ?? null,
    },

    homework: {
      getById: async (id) => seed.homework.find((item) => item.id === id) ?? null,
      getByAnswerKey: async (key: HomeworkAnswerKey) =>
        seed.homework.find(
          (item) =>
            item.enrollmentId === key.enrollmentId &&
            item.lessonVersionId === key.lessonVersionId &&
            item.sectionId === key.sectionId,
        ) ?? null,
      listByEnrollment: async (enrollmentId) =>
        seed.homework.filter((item) => item.enrollmentId === enrollmentId),
      saveAnswer: notWritten,
      submit: notWritten,
    },

    blockStates: {
      getByKey: async (key: BlockStateKey) =>
        seed.blockStates.find(
          (item) =>
            item.enrollmentId === key.enrollmentId &&
            item.lessonVersionId === key.lessonVersionId &&
            item.blockId === key.blockId,
        ) ?? null,
      listByLessonVersion: async (enrollmentId, lessonVersionId) =>
        seed.blockStates.filter(
          (item) => item.enrollmentId === enrollmentId && item.lessonVersionId === lessonVersionId,
        ),
      save: notWritten,
    },
  }
}

const reread = (version: LocalLessonVersion | null): LocalLessonVersion | null =>
  version === null ? null : structuredClone(version)
