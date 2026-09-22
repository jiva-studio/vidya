import { HttpError } from '@vidya/client'
import type { SchoolCard } from '@vidya/protocol'
import { ref } from 'vue'

import { useHttp } from '@/shared/api'
import { useConnection } from '@/shared/connection'
import { useSiteStatus } from '@/shared/status'
import { useSyncRuns } from '@/shared/sync'

import { joinSchool, resolveSchool } from '../api'
import type { JoinStage } from '../types'

const isUnknownCode = (error: unknown): boolean =>
  error instanceof HttpError && error.status === 404

/** The school has no role to give a student, so there is nothing to join yet. */
const takesNoStudents = (error: unknown): boolean =>
  error instanceof HttpError && error.status === 409

/**
 * The two steps of arriving by a link: see the school, then belong to it.
 *
 * Resolving happens with no session and no local database, because that is
 * what the person following a printed link has. Joining is the one moment the
 * site asks the server for something a student owns — afterwards the school's
 * courses arrive through synchronisation, and a run is asked for at once so
 * that they start arriving now rather than at the next reload.
 */
export const useJoinSchool = (code: string) => {
  const http = useHttp()
  const { connection } = useConnection()
  const status = useSiteStatus()
  const runs = useSyncRuns()

  const school = ref<SchoolCard | undefined>(undefined)
  const stage = ref<JoinStage>('resolving')

  const resolve = async (): Promise<void> => {
    stage.value = 'resolving'

    try {
      school.value = await resolveSchool(http, code)
      stage.value = 'ready'
    } catch (error) {
      stage.value = isUnknownCode(error) ? 'unknown' : 'failed'

      // A code nobody holds is an ordinary answer and says itself on the
      // screen; anything else is a fault this site cannot explain, and the
      // only record of it is here.
      if (stage.value === 'failed') console.warn('the joining code could not be resolved', error)
    }
  }

  const join = async (): Promise<void> => {
    const owner = connection.value?.ownerId
    const target = school.value
    if (owner === undefined || target === undefined) return

    stage.value = 'joining'

    try {
      await joinSchool(http, owner, target.id)
      status.markJoined()
      runs.requestRun()
      stage.value = 'joined'
    } catch (error) {
      stage.value = takesNoStudents(error) ? 'closed' : 'failed'

      if (stage.value === 'failed') console.warn('the school could not be joined', error)
    }
  }

  /** The same step again: the one that could not be finished is the one to repeat. */
  const retry = (): Promise<void> => (school.value === undefined ? resolve() : join())

  return { school, stage, resolve, join, retry }
}
