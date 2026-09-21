import type {
  IBlockStateRepository,
  ICourseRepository,
  IEnrollmentRepository,
  IGroupRepository,
  IHomeworkRepository,
  ILessonRepository,
  ILessonVersionRepository,
  ISchoolRepository,
} from '@vidya/client'

import { useOutboxView } from './outboxView'
import { runningSyncs, type SyncTriggers } from './sync'

/**
 * The device, as the screens read and write it.
 *
 * The ports come from the running engine rather than being built here, because
 * the three writable ones are journaled: a write that skipped the journal
 * would never be sent, and the student would watch their answer sit on the
 * phone forever.
 *
 * A write is also one of the four things that ask for a sync run, so the
 * writable ports are wrapped here to say so. The ask is debounced — a lesson
 * answered block by block is one run, not six — and the outbox snapshot the
 * screens read is refreshed at once, so a saved answer shows as waiting rather
 * than as accepted until the run comes round.
 *
 * Every port is resolved at the moment it is used, not when a screen asks for
 * the set. A screen mounted before the engines are up — or while the last
 * connection is being signed out — reads an empty device instead of throwing
 * in `setup()`, which takes the whole screen down and leaves nothing to show.
 * Writing has no such answer: there is no identity to write for, so it refuses.
 *
 * One connection is served: screens showing several schools at once need
 * readers that merge across identities, which is the next step and not a
 * different composition root.
 */
export interface DeviceRepositories {
  readonly schools: ISchoolRepository
  readonly courses: ICourseRepository
  readonly lessons: ILessonRepository
  readonly lessonVersions: ILessonVersionRepository
  readonly groups: IGroupRepository
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
  const started = () => runningSyncs()[0]

  return {
    get schools() {
      return started()?.engine.schools ?? emptyDevice.schools
    },
    get courses() {
      return started()?.engine.courses ?? emptyDevice.courses
    },
    get lessons() {
      return started()?.engine.lessons ?? emptyDevice.lessons
    },
    get lessonVersions() {
      return started()?.engine.lessonVersions ?? emptyDevice.lessonVersions
    },
    get groups() {
      return started()?.engine.groups ?? emptyDevice.groups
    },
    get enrollments() {
      const running = started()
      if (running === undefined) return emptyDevice.enrollments

      return {
        ...running.engine.enrollments,
        request: announcing(running.engine.enrollments.request, running.triggers),
        withdraw: announcing(running.engine.enrollments.withdraw, running.triggers),
        archive: announcing(running.engine.enrollments.archive, running.triggers),
        unarchive: announcing(running.engine.enrollments.unarchive, running.triggers),
      }
    },
    get homework() {
      const running = started()
      if (running === undefined) return emptyDevice.homework

      return {
        ...running.engine.homework,
        saveAnswer: announcing(running.engine.homework.saveAnswer, running.triggers),
        submit: announcing(running.engine.homework.submit, running.triggers),
      }
    },
    get blockStates() {
      const running = started()
      if (running === undefined) return emptyDevice.blockStates

      return {
        ...running.engine.blockStates,
        save: announcing(running.engine.blockStates.save, running.triggers),
      }
    },
  }
}

/**
 * Runs the write, then says a row is waiting.
 *
 * After the write and only if it succeeded: a refused one journaled nothing,
 * and asking for a run over it would be a network call made for no row.
 */
function announcing<TArgs extends unknown[], TResult>(
  write: (...args: TArgs) => Promise<TResult>,
  triggers: SyncTriggers,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    const written = await write(...args)

    useOutboxView().refresh()
    triggers.soon()

    return written
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
  groups: { listRecruitingByCourse: async () => [], getById: async () => null },
  enrollments: {
    list: async () => [],
    getById: async () => null,
    getLiveByCourse: async () => null,
    request: refuse,
    withdraw: refuse,
    archive: refuse,
    unarchive: refuse,
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
