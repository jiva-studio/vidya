import { onMounted, ref, shallowRef } from 'vue'

import { isUnauthorized, OfflineError } from '@/ports'

/** Which of the three failures a screen is looking at. */
export type RemoteFailure = 'offline' | 'unauthorized' | 'failed'

const classify = (error: unknown): RemoteFailure => {
  if (error instanceof OfflineError) return 'offline'
  if (isUnauthorized(error)) return 'unauthorized'
  return 'failed'
}

/**
 * One load, with the three states a screen has to tell apart.
 *
 * `loaded` is separate from `busy` so a reload does not blank out content that
 * is already on screen, and `failure` is a kind rather than a message so the
 * wording stays with the screen that shows it.
 */
export function useRemoteData<TData>(load: () => Promise<TData>, initial: TData) {
  const data = shallowRef<TData>(initial)
  const busy = ref(false)
  const loaded = ref(false)
  const failure = ref<RemoteFailure | undefined>(undefined)

  const reload = async () => {
    busy.value = true
    failure.value = undefined
    try {
      data.value = await load()
      loaded.value = true
    } catch (error) {
      failure.value = classify(error)
    } finally {
      busy.value = false
    }
  }

  onMounted(reload)

  return { data, busy, loaded, failure, reload }
}
