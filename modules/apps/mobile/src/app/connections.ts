import { createGlobalState } from '@vueuse/core'
import { computed, ref } from 'vue'

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

const persisted = new PreferencesConnectionStore()

export const useConnections = createGlobalState(() => {
  const connections = ref<readonly Connection[]>([])

  const restore = async () => {
    connections.value = await persisted.list()
  }

  const signIn = async (input: SignInToConnection) => {
    const baseUrl = normaliseBaseUrl(input.baseUrl)
    const session = input.session

    await connectionStore.add({
      baseUrl,
      ownerId: await ownerIdAt(baseUrl, session),
      session,
      needsSignIn: false,
    })
  }

  const signOut = async (baseUrl: string) => {
    const address = normaliseBaseUrl(baseUrl)

    await stopSync(address)
    await connectionStore.remove(address)
  }

  const markNeedsSignIn = (baseUrl: string) =>
    connectionStore.update(normaliseBaseUrl(baseUrl), { needsSignIn: true })

  /**
   * The connections whose token the server has stopped accepting.
   *
   * A screen asks this to say "sign in to this school again" — and says it
   * about one school rather than about the app: the others are still syncing,
   * and everything already downloaded stays readable whatever this answers.
   */
  const awaitingSignIn = computed(() =>
    connections.value.filter((connection) => connection.needsSignIn),
  )

  return { connections, awaitingSignIn, restore, signIn, signOut, markNeedsSignIn }
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

/**
 * The one way the registry changes.
 *
 * Every write moves both halves: the rows that outlive the launch, and the
 * list the screens are watching. The engine writes here too — a renewed
 * session, a renewal the server refused — and a write that reached storage
 * without reaching the list is a student told on the next launch that the
 * school they are looking at wants them to sign in again.
 */
export const connectionStore: IConnectionStore = {
  list: () => persisted.list(),

  add: async (connection) => {
    await persisted.add(connection)
    await useConnections().restore()
  },

  update: async (baseUrl, changes) => {
    await persisted.update(baseUrl, changes)
    await useConnections().restore()
  },

  remove: async (baseUrl) => {
    await persisted.remove(baseUrl)
    await useConnections().restore()
  },
}
