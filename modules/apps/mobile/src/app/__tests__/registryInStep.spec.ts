import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fakeSyncNetwork } from './fakeSyncNetwork'

/**
 * The stored connections and the list the screens watch, moving together.
 *
 * Both halves of the registry are written by different parts of the app — the
 * engine renews a session or is refused one, a screen signs in or out — and a
 * write that reaches storage without reaching the list is a screen that shows
 * the truth of the previous launch. There is nothing to notice while using the
 * app: the next launch is right, and the launch you are in is wrong.
 */

const platform = vi.hoisted(() => new Map<string, string>())

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: ({ key }: { key: string }) =>
      Promise.resolve({ value: platform.get(key) ?? (key === 'device-id' ? 'device-a' : null) }),
    set: ({ key, value }: { key: string; value: string }) => {
      platform.set(key, value)
      return Promise.resolve()
    },
    remove: ({ key }: { key: string }) => {
      platform.delete(key)
      return Promise.resolve()
    },
  },
}))

vi.mock('@capacitor/app', () => ({
  App: { addListener: () => Promise.resolve({ remove: () => Promise.resolve() }) },
}))

vi.mock('@capacitor/network', () => ({
  Network: { addListener: () => Promise.resolve({ remove: () => Promise.resolve() }) },
}))

const SCHOOL_A = 'https://school-a.test'

const network = fakeSyncNetwork()

/** The app as it stands after a sign-in, with an engine running. */
const running = async () => {
  const { useConnections, connectionStore } = await import('../connections')
  const { startSync } = await import('../sync')
  const { openTestDatabase } = await import('@vidya/client/testing')

  const server = network.server(SCHOOL_A)
  const connections = useConnections()
  await connections.restore()
  await connections.signIn({
    baseUrl: SCHOOL_A,
    session: { accessToken: server.accessToken, refreshToken: server.refreshToken },
  })

  const { db } = await openTestDatabase()
  const connection = connections.connections.value[0]!
  const sync = await startSync({ db, connection, connections: connectionStore })

  return { connections, server, sync }
}

describe('the registry as the screens read it', () => {
  beforeEach(() => {
    platform.clear()
    vi.resetModules()
    network.install()
    network.add(SCHOOL_A, 'owner-a')
  })

  afterEach(() => {
    network.restore()
  })

  it('lights the notice in the session it happened in, not the next one', async () => {
    const { connections, server, sync } = await running()
    expect(connections.awaitingSignIn.value).toEqual([])

    server.expired = true
    server.refreshRefused = true
    await sync.triggers.now()

    // What a screen reads, without anybody having reloaded anything.
    expect(connections.awaitingSignIn.value.map((row) => row.baseUrl)).toEqual([SCHOOL_A])
    expect(connections.connections.value[0]!.needsSignIn).toBe(true)
  })

  it('drops a school from the list the moment it is signed out of', async () => {
    const { connections } = await running()
    expect(connections.connections.value).toHaveLength(1)

    await connections.signOut(SCHOOL_A)

    // A screen still holding the connection would send the student to a
    // school they have just left, and the guard would let them in.
    expect(connections.connections.value).toEqual([])
    expect(connections.awaitingSignIn.value).toEqual([])
  })

  it('carries a renewed session into the list the screens read from', async () => {
    const { connections, server, sync } = await running()

    // The access token is refused, the refresh is not: the run renews and
    // carries on, and the session it renewed is the one the app now holds.
    server.expired = true
    await sync.triggers.now()

    expect(connections.awaitingSignIn.value).toEqual([])
    expect(connections.connections.value[0]!.session).toEqual({
      accessToken: server.accessToken,
      refreshToken: server.refreshToken,
    })
  })
})
