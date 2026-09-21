import { createGlobalState } from '@vueuse/core'
import { computed, ref } from 'vue'

import type { SiteStatus, StorageDurability } from './types'

export const useSiteStatus = createGlobalState((): SiteStatus => {
  const inFlight = ref(0)
  const firstRunCompleted = ref(false)
  const done = ref(0)
  const writing = ref(false)
  const joined = ref(false)
  const storage = ref<StorageDurability>('unknown')

  const runStarted = () => {
    inFlight.value += 1
  }

  const runFinished = (applied: number, completed: boolean) => {
    inFlight.value = Math.max(0, inFlight.value - 1)
    done.value += applied
    if (completed) firstRunCompleted.value = true
  }

  return {
    syncing: computed(() => inFlight.value > 0),
    firstRunCompleted,
    done,
    writing,
    joined,
    storage,
    runStarted,
    runFinished,
    markFilled: () => {
      firstRunCompleted.value = true
    },
    markJoined: () => {
      joined.value = true
    },
    markWriting: (isWriting: boolean) => {
      writing.value = isWriting
    },
    markStorage: (durability: StorageDurability) => {
      storage.value = durability
    },
  }
})
