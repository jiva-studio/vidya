import { createGlobalState } from '@vueuse/core'
import { ref } from 'vue'

import { PreferencesSessionStore } from '@/infra'
import type { Session } from '@/ports'

const store = new PreferencesSessionStore()

/**
 * The signed-in session, held once for the whole app.
 *
 * Reactive because the router and the header read it, and persisted because it
 * has to survive a relaunch — a student who has to sign in every morning will
 * not use the app offline.
 */
export const useSession = createGlobalState(() => {
  const session = ref<Session | undefined>(undefined)

  const restore = async () => {
    session.value = await store.read()
  }

  const start = async (value: Session) => {
    await store.write(value)
    session.value = value
  }

  const end = async () => {
    await store.clear()
    session.value = undefined
  }

  return { session, restore, start, end }
})

export const sessionStore = store
