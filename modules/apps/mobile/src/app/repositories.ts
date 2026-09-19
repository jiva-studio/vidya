import type {
  IBlockStateRepository,
  ICourseRepository,
  IEnrollmentRepository,
  IHomeworkRepository,
  ILessonRepository,
  ILessonVersionRepository,
  ISchoolRepository,
} from '@/ports'

import { runningSyncs } from './sync'

/**
 * The device, as the screens read and write it.
 *
 * They come from the running engine rather than being built here, because the
 * three writable ones are journaled: a write that skipped the journal would
 * never be sent, and the student would watch their answer sit on the phone
 * forever.
 *
 * One connection is served. Screens that show several schools at once are the
 * next step, and they need readers that merge across identities rather than a
 * different composition root.
 */
export interface DeviceRepositories {
  readonly schools: ISchoolRepository
  readonly courses: ICourseRepository
  readonly lessons: ILessonRepository
  readonly lessonVersions: ILessonVersionRepository
  readonly enrollments: IEnrollmentRepository
  readonly homework: IHomeworkRepository
  readonly blockStates: IBlockStateRepository
}

export function useRepositories(): DeviceRepositories {
  const started = runningSyncs()[0]
  if (started === undefined) throw new Error('no connection is running; sign in first')

  const { schools, courses, lessons, lessonVersions, enrollments, homework, blockStates } =
    started.engine

  return { schools, courses, lessons, lessonVersions, enrollments, homework, blockStates }
}
