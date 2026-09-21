import { HttpError } from '@vidya/client'
import type { SchoolId } from '@vidya/domain'
import { ref } from 'vue'

import { useHttp } from '@/shared/api'
import { useConnection } from '@/shared/connection'
import { useSyncRuns } from '@/shared/sync'

import { leaveSchool } from '../api'
import type { LeaveStage } from '../types'

/** The school refuses because this student is one of its owners. */
const ownsTheSchool = (error: unknown): boolean =>
  error instanceof HttpError && error.status === 409

/**
 * Leaving, as the settings screen does it.
 *
 * The membership is the server's to take back: a role grants it, and the
 * places it carried are revoked with it. A run is asked for straight away so
 * that the school and its courses leave this machine now rather than at the
 * next reload — until the run happens they are still here, and a student who
 * has just left would otherwise go on seeing everything they left.
 */
export const useLeaveSchool = () => {
  const http = useHttp()
  const { connection } = useConnection()
  const runs = useSyncRuns()

  const stage = ref<LeaveStage>('idle')

  const leave = async (schoolId: SchoolId): Promise<void> => {
    const owner = connection.value?.ownerId
    if (stage.value === 'leaving' || owner === undefined) return

    stage.value = 'leaving'

    try {
      await leaveSchool(http, owner, schoolId)
      runs.requestRun()
      stage.value = 'left'
    } catch (error) {
      stage.value = ownsTheSchool(error) ? 'owner' : 'failed'

      if (stage.value === 'failed') console.warn('the school could not be left', error)
    }
  }

  return { stage, leave }
}
