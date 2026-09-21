import {
  createSqlBlockStateRepository,
  createSqlCourseRepository,
  createSqlEnrollmentRepository,
  createSqlLessonRepository,
  createSqlLessonVersionRepository,
  createSqlSchoolRepository,
  type IDatabase,
  type ISchoolRepository,
} from '@vidya/client'
import { toIsoDateTime } from '@vidya/domain'

import { useConnection } from '@/shared/connection'
import type { LocalEducation } from '@/shared/data'

/**
 * The local reads the screens are given, bound to whoever is signed in.
 *
 * The identity is read per call rather than captured: it appears when somebody
 * signs in, long after this is built, and every row of the database is keyed
 * by it. A repository holding the empty owner would answer every screen with
 * nothing and look exactly like a school that has not arrived.
 */
const ownerId = () => useConnection().connection.value?.ownerId ?? ''

export const schoolsOf = (db: IDatabase): ISchoolRepository =>
  createSqlSchoolRepository({ db, ownerId })

/**
 * The rest of what a screen reads, over the same database and the same owner.
 *
 * The two repositories that also write are stamped with a clock they never
 * reach for here: only their reads are handed out, because a write of theirs
 * would skip the journal that makes it reach the server.
 */
export const educationOf = (db: IDatabase): LocalEducation => {
  const now = () => toIsoDateTime(new Date())

  return {
    courses: createSqlCourseRepository({ db, ownerId }),
    lessons: createSqlLessonRepository({ db, ownerId }),
    lessonVersions: createSqlLessonVersionRepository({ db, ownerId }),
    enrollments: createSqlEnrollmentRepository({ db, ownerId, now }),
    blockStates: createSqlBlockStateRepository({ db, ownerId, now }),
  }
}
