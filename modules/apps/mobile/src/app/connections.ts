import { createGlobalState } from '@vueuse/core'
import { ref } from 'vue'

import { ownerIdAt, PreferencesConnectionStore } from '@/infra'
import type { Connection, HttpClient, IConnectionStore, Session } from '@/ports'
import { normaliseBaseUrl } from '@/ports'

import { endSessionOn401 } from './endSessionOn401'
import { connectionClient, stopSync } from './sync'

/**
 * The servers this handset is signed in to.
 *
 * A student can study in schools that live on different servers, so an identity
 * belongs to a connection rather than to the app. Two things follow, and both
 * are decided here.
 *
 * **Signing in asks the server who the bearer is.** A session carries tokens
 * and no user id, while `owner_id` keys every table on the device — so the
 * profile call is part of signing in, not an optimisation. Skipping it would
 * file the school's rows under nobody.
 *
 * **Signing out is not a delete.** The triggers stop and the SQLite lock goes
 * back, but nothing written on the device is removed: the student's unsent
 * answers are theirs whether or not they are signed in at this moment.
 */

/** What a sign-in already holds: the address, and the tokens it was given. */
export interface SignInToConnection {
  readonly baseUrl: string
  readonly session: Session
}

const store = new PreferencesConnectionStore()

export const useConnections = createGlobalState(() => {
  const connections = ref<readonly Connection[]>([])

  const restore = async () => {
    connections.value = await store.list()
  }

  const signIn = async (input: SignInToConnection) => {
    const baseUrl = normaliseBaseUrl(input.baseUrl)
    const session = input.session

    await store.add({
      baseUrl,
      ownerId: await ownerIdAt(baseUrl, session),
      session,
      needsSignIn: false,
    })

    await restore()
  }

  const signOut = async (baseUrl: string) => {
    const address = normaliseBaseUrl(baseUrl)

    await stopSync(address)
    await store.remove(address)
    await restore()
  }

  const markNeedsSignIn = async (baseUrl: string) => {
    await store.update(normaliseBaseUrl(baseUrl), { needsSignIn: true })
    await restore()
  }

  return { connections, restore, signIn, signOut, markNeedsSignIn }
})

/**
 * The transport for signing in to a server, including one nothing is connected
 * to yet.
 *
 * Sign-in is the one exchange that happens before a connection exists, so the
 * address comes as an argument: which server a student is joining is the
 * screen's business, and the next school they add will be at another one.
 *
 * The token, once there is one, is read from the registry rather than held
 * here — a copy would go on being sent after the engine renewed it. A refusal
 * marks this one connection as needing a new sign-in and stops there: ending
 * every session would sign the student out of schools that are still
 * perfectly reachable.
 */
export function clientForSignIn(baseUrl: string): HttpClient {
  const address = normaliseBaseUrl(baseUrl)
  const { connections, markNeedsSignIn } = useConnections()

  const sessionAt = () =>
    connections.value.find((connection) => connection.baseUrl === address)?.session

  return endSessionOn401(connectionClient(address, sessionAt), () => markNeedsSignIn(address))
}

/** The persisted registry, for the parts of the app that write to it directly. */
export const connectionStore: IConnectionStore = store
