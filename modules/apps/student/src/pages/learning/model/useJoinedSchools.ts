import type { LocalSchool } from '@vidya/client'
import { onMounted, ref, watch } from 'vue'

import { useLocalSchools } from '@/shared/data'
import { useSiteStatus } from '@/shared/status'

/**
 * The schools this machine holds, re-read as synchronisation brings more.
 *
 * Read from the local database rather than asked of the server: membership is
 * what the student sees in their lists, and a second source for it would let
 * the screen say one thing while the lists say another.
 */
export const useJoinedSchools = () => {
  const repository = useLocalSchools()
  const status = useSiteStatus()
  const schools = ref<readonly LocalSchool[]>([])

  const reload = async (): Promise<void> => {
    try {
      schools.value = await repository.list()
    } catch (error) {
      // A reading tab can hold an image written before the writing tab created
      // the schema. An unreadable table is one moment of "nothing yet", not a
      // screen worth failing, and the next run re-reads it.
      console.warn('the local schools could not be read', error)
    }
  }

  onMounted(() => void reload())
  watch([status.done, status.firstRunCompleted], () => void reload())

  return { schools }
}
