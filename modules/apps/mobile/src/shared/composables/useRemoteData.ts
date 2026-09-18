import { onIonViewWillEnter } from '@ionic/vue'
import { onMounted, ref, shallowRef, watch, type WatchSource } from 'vue'

import { isUnauthorized, OfflineError } from '@/ports'

/** Which of the three failures a screen is looking at. */
export type RemoteFailure = 'offline' | 'unauthorized' | 'failed'

const classify = (error: unknown): RemoteFailure => {
  if (error instanceof OfflineError) return 'offline'
  if (isUnauthorized(error)) return 'unauthorized'
  return 'failed'
}

interface RemoteDataOptions {
  /** Values that change what `load` would answer, so a change re-runs it. */
  readonly watching?: WatchSource[]
}

/**
 * One load, with the three states a screen has to tell apart.
 *
 * `loaded` is separate from `busy` so a reload does not blank out content that
 * is already on screen, and `failure` is a kind rather than a message so the
 * wording stays with the screen that shows it.
 *
 * It reloads on `onIonViewWillEnter` as well as on mount: Ionic keeps a page
 * alive when the student navigates away, so a screen returned to would
 * otherwise show whatever it held when it was left — a submitted homework
 * still reading "not submitted", an accepted enrolment still pending.
 */
export function useRemoteData<TData>(
  load: () => Promise<TData>,
  initial: TData,
  options: RemoteDataOptions = {},
) {
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
  onIonViewWillEnter(reload)

  // A cached page can be reused for a different id, and then the data on screen
  // belongs to the previous one.
  if (options.watching?.length) {
    watch(options.watching, () => {
      loaded.value = false
      void reload()
    })
  }

  return { data, busy, loaded, failure, reload }
}
