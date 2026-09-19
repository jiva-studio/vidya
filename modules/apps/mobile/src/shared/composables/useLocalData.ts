import { onIonViewWillEnter } from '@ionic/vue'
import { onMounted, ref, shallowRef, watch, type WatchSource } from 'vue'

import { useSyncStatus } from '@/app'

interface LocalDataOptions {
  /** Values that change what `load` would answer, so a change re-runs it. */
  readonly watching?: WatchSource[]
}

/**
 * One read of the device, re-read whenever a sync run has changed it.
 *
 * The device is the source, so there is no offline state and no failure kind to
 * tell apart: a read either answers with what is stored or the database is
 * broken, and the second is a startup problem rather than a screen's.
 *
 * What a screen cannot do is read once and stay as it was. A run lands rows
 * while the student is looking at them, and Ionic keeps a page alive when it is
 * left, so a catalogue loaded at mount would show the first run's contents
 * until the app was restarted. The end of a run — `syncing` falling back to
 * `false` — is the moment the device changed, and it is watched synchronously
 * so a screen inspected straight afterwards is not showing the state from
 * before it.
 */
export function useLocalData<TData>(
  load: () => Promise<TData>,
  initial: TData,
  options: LocalDataOptions = {},
) {
  const data = shallowRef<TData>(initial)
  const busy = ref(false)
  const loaded = ref(false)

  // Loads can overlap — mount, view-enter and the end of a run all start one —
  // and they do not come back in the order they left. Only the newest may write.
  let issued = 0

  const reload = async () => {
    const attempt = ++issued
    busy.value = true
    try {
      const result = await load()
      if (attempt !== issued) return
      data.value = result
      loaded.value = true
    } finally {
      if (attempt === issued) busy.value = false
    }
  }

  onMounted(reload)
  onIonViewWillEnter(reload)

  watch(
    useSyncStatus().syncing,
    (now, before) => {
      if (before && !now) void reload()
    },
    { flush: 'sync' },
  )

  // A cached page can be reused for a different id, and then the data on screen
  // belongs to the previous one.
  if (options.watching?.length) {
    watch(options.watching, () => {
      loaded.value = false
      void reload()
    })
  }

  return { data, busy, loaded, reload }
}
