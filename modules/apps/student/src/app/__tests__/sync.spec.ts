import type { HttpClient, IDatabase } from '@vidya/client'
import { openTestDatabase } from '@vidya/client/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useConnection } from '@/shared/connection'
import type { INetworkStatus } from '@/shared/platform'
import { useSiteStatus } from '@/shared/status'

import { syncWithConnection } from '../sync'

const PULL = '/sync/pull'

const emptyPage = { changes: [], cursors: {}, scopes: [], checksums: {}, hasMore: false }

const fakeHttpClient = () => {
  const calls: string[] = []

  const client = {
    get: async (path: string) => {
      calls.push(path)
      return {}
    },
    post: async (path: string) => {
      calls.push(path)
      return emptyPage
    },
    patch: async (path: string) => {
      calls.push(path)
      return {}
    },
    delete: async (path: string) => {
      calls.push(path)
    },
  } as unknown as HttpClient

  return { client, calls }
}

const network = (online = true): INetworkStatus & { comeBack: () => void } => {
  let handler: (() => void) | undefined

  return {
    isOnline: () => online,
    onOnline: (next) => {
      handler = next
      return () => {
        handler = undefined
      }
    },
    comeBack: () => handler?.(),
  }
}

/**
 * Long enough for a run that should not have started to have started.
 *
 * The claims below are about something not happening, and a microtask flush
 * would prove only that it had not happened yet: the runs that do happen reach
 * the transport within a millisecond or two of the connection appearing.
 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 100))

const signIn = () => {
  const connection = useConnection()
  connection.offer({ accessToken: 'access', refreshToken: 'refresh' })
  connection.signIn('user-1' as never)
}

/**
 * The composition root's one moving part: an engine that exists exactly while
 * somebody is signed in, over the one connection this site has.
 */
describe('the engine of the writing tab', () => {
  let db: IDatabase
  let stop: (() => void) | undefined

  beforeEach(async () => {
    localStorage.clear()
    useConnection().signOut()
    db = (await openTestDatabase()).db
  })

  afterEach(async () => {
    stop?.()
    stop = undefined
    await db.close()
  })

  it('stays silent while nobody is signed in', async () => {
    const http = fakeHttpClient()

    stop = syncWithConnection({ db, http: http.client, network: network() })
    await settle()

    expect(http.calls).toEqual([])
  })

  it('runs as soon as there is a connection to run over', async () => {
    const http = fakeHttpClient()

    stop = syncWithConnection({ db, http: http.client, network: network() })
    signIn()

    await vi.waitFor(() => expect(http.calls).toContain(PULL))
  })

  it('tells the screens a run has completed, so an empty list means empty', async () => {
    const http = fakeHttpClient()

    stop = syncWithConnection({ db, http: http.client, network: network() })
    signIn()

    await vi.waitFor(() => expect(useSiteStatus().firstRunCompleted.value).toBe(true))
  })

  it('does not spend a request where the browser says there is no network', async () => {
    const http = fakeHttpClient()
    const offline = network(false)

    stop = syncWithConnection({ db, http: http.client, network: offline })
    signIn()

    await vi.waitFor(() => expect(useConnection().isSignedIn.value).toBe(true))
    await settle()

    expect(http.calls).toEqual([])
  })

  it('runs again when the network comes back', async () => {
    const http = fakeHttpClient()
    const connected = network()

    stop = syncWithConnection({ db, http: http.client, network: connected })
    signIn()
    await vi.waitFor(() => expect(http.calls).toContain(PULL))

    const before = http.calls.length
    connected.comeBack()

    await vi.waitFor(() => expect(http.calls.length).toBeGreaterThan(before))
  })

  it('stops the engine when the student signs out', async () => {
    const http = fakeHttpClient()
    const connected = network()

    stop = syncWithConnection({ db, http: http.client, network: connected })
    signIn()
    await vi.waitFor(() => expect(http.calls).toContain(PULL))

    useConnection().signOut()
    await settle()

    const after = http.calls.length
    connected.comeBack()
    await settle()

    expect(http.calls).toHaveLength(after)
  })
})
