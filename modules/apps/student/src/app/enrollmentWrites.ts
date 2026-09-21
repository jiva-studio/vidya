import type { IEnrollmentRepository } from '@vidya/client'

import { type EnrollmentWrites, useOutboxView, useSyncRuns } from '@/shared/sync'

/**
 * The student's own writes, wrapped in what has to happen around them.
 *
 * Nothing here reaches the school: the repository journals the row, and a run
 * carries it. The run is asked for at once because a tab is never woken in the
 * background — without it a request made now would leave at the next reload —
 * and the journal is re-read straight away, so what the student just wrote
 * shows as waiting rather than as accepted until a run comes round.
 */
export const announceEnrollmentWrites = (
  enrollments: IEnrollmentRepository,
): EnrollmentWrites => ({
  request: announcing(enrollments.request.bind(enrollments)),
  withdraw: announcing(enrollments.withdraw.bind(enrollments)),
  archive: announcing(enrollments.archive.bind(enrollments)),
  unarchive: announcing(enrollments.unarchive.bind(enrollments)),
})

/**
 * After the write and only if it succeeded: a refused one journaled nothing,
 * and asking for a run over it would be a request made for no row.
 */
const announcing = <TArgs extends unknown[], TResult>(
  write: (...args: TArgs) => Promise<TResult>,
): ((...args: TArgs) => Promise<TResult>) => {
  return async (...args: TArgs) => {
    const stored = await write(...args)

    useOutboxView().refresh()
    useSyncRuns().requestRun()

    return stored
  }
}
