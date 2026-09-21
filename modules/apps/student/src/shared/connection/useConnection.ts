import type { Connection, Session } from '@vidya/client'
import type { UserId } from '@vidya/domain'
import { createGlobalState } from '@vueuse/core'
import { computed, ref } from 'vue'

import { config } from '@/shared/config'

import { clearStored, readStored, writeStored } from './tokenStore'

/**
 * The one server this site talks to, and the identity held there.
 *
 * The handset keeps a registry of connections because a student can study in
 * schools that live on different servers. A browser is open on one origin and
 * has one server behind it, so there is one connection here, it is never
 * shown, and nothing switches between tokens.
 *
 * Signing in takes two steps because a session carries tokens and no user id,
 * while `owner_id` keys every row of the local database: the tokens are
 * offered first, so the transport can carry them, and the connection exists
 * once the server has said whose they are.
 *
 * A restored connection carries no access token — only the refresh token
 * outlives the tab — and the first request that is refused renews it.
 */
export const useConnection = createGlobalState(() => {
  const connection = ref<Connection | undefined>(undefined)
  const offered = ref<Session | undefined>(undefined)

  const restore = () => {
    const stored = readStored()
    if (stored === undefined) return

    connection.value = {
      baseUrl: config.apiBaseUrl,
      ownerId: stored.ownerId,
      session: { accessToken: '', refreshToken: stored.refreshToken },
      needsSignIn: false,
    }
  }

  /** Hands the transport the tokens a sign-in has just been given. */
  const offer = (session: Session) => {
    offered.value = session
  }

  const signIn = (ownerId: UserId) => {
    const session = offered.value
    if (session === undefined) throw new Error('no tokens were offered to sign in with')

    writeStored({ ownerId, refreshToken: session.refreshToken })
    connection.value = { baseUrl: config.apiBaseUrl, ownerId, session, needsSignIn: false }
    offered.value = undefined
  }

  /** Takes the session a renewal produced, or records that it was refused. */
  const adopt = (changes: Partial<Omit<Connection, 'baseUrl' | 'ownerId'>>) => {
    const current = connection.value
    if (current === undefined) return

    if (changes.session) {
      writeStored({ ownerId: current.ownerId, refreshToken: changes.session.refreshToken })
    }

    connection.value = { ...current, ...changes }
  }

  const signOut = () => {
    clearStored()
    connection.value = undefined
    offered.value = undefined
  }

  return {
    connection,
    session: computed(() => connection.value?.session ?? offered.value),
    isSignedIn: computed(() => connection.value !== undefined),
    restore,
    offer,
    signIn,
    adopt,
    signOut,
  }
})
