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
 * Every port is resolved at the moment it is used, not when a screen asks for
 * the set. A screen mounted before the engines are up — or while the last
 * connection is being signed out — reads an empty device instead of throwing
 * in `setup()`, which takes the whole screen down and leaves nothing to show.
 * Writing has no such answer: there is no identity to write for, so it refuses.
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

/** Thrown when something would be written while the app holds no connection. */
export class NoConnectionError extends Error {
  constructor() {
    super('no connection is running; sign in first')
    this.name = 'NoConnectionError'
  }
}

export function useRepositories(): DeviceRepositories {
  const engine = () => runningSyncs()[0]?.engine

  return {
    get schools() {
      return engine()?.schools ?? emptyDevice.schools
    },
    get courses() {
      return engine()?.courses ?? emptyDevice.courses
    },
    get lessons() {
      return engine()?.lessons ?? emptyDevice.lessons
    },
    get lessonVersions() {
      return engine()?.lessonVersions ?? emptyDevice.lessonVersions
    },
    get enrollments() {
      return engine()?.enrollments ?? emptyDevice.enrollments
    },
    get homework() {
      return engine()?.homework ?? emptyDevice.homework
    },
    get blockStates() {
      return engine()?.blockStates ?? emptyDevice.blockStates
    },
  }
}

// A rejected promise rather than a throw: the ports answer with promises, and
// a caller awaiting one must not be hit by an exception on the call itself.
const refuse = (): Promise<never> => Promise.reject(new NoConnectionError())

/** What the device looks like while no connection is running: nothing on it. */
const emptyDevice: DeviceRepositories = {
  schools: { list: async () => [], getById: async () => null },
  courses: { list: async () => [], getById: async () => null },
  lessons: { listByCourse: async () => [], getById: async () => null },
  lessonVersions: { getById: async () => null, getPublished: async () => null },
  enrollments: {
    list: async () => [],
    getById: async () => null,
    getByCourse: async () => null,
    request: refuse,
    withdraw: refuse,
  },
  homework: {
    getById: async () => null,
    getByAnswerKey: async () => null,
    listByEnrollment: async () => [],
    saveAnswer: refuse,
    submit: refuse,
  },
  blockStates: {
    getByKey: async () => null,
    listByLessonVersion: async () => [],
    save: refuse,
  },
}
