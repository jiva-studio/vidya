import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fakeSyncNetwork } from './fakeSyncNetwork'

/**
 * The transport sign-in speaks through.
 *
 * It is built here rather than on a screen, and it takes the address as an
 * argument: which server a student is joining is the screen's business, and
 * the next school they add is at another one. A client that read the address
 * from the build's configuration could reach exactly one server, whatever the
 * student typed.
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

const SCHOOL_A = 'https://school-a.test'
const SCHOOL_B = 'https://school-b.test'

const network = fakeSyncNetwork()

/** A registry holding one connection to `SCHOOL_A`, freshly imported. */
const signedIn = async () => {
  const { useConnections, clientForSignIn } = await import('../connections')
  const connections = useConnections()
  await connections.restore()

  const server = network.server(SCHOOL_A)
  await connections.signIn({
    baseUrl: SCHOOL_A,
    session: { accessToken: server.accessToken, refreshToken: server.refreshToken },
  })

  return { connections, clientForSignIn }
}

describe('the client sign-in speaks through', () => {
  beforeEach(() => {
    platform.clear()
    vi.resetModules()
    network.install()
    network.add(SCHOOL_A, 'owner-a')
    network.add(SCHOOL_B, 'owner-b')
  })

  afterEach(() => {
    network.restore()
  })

  it('reaches the address it was given and carries that server token', async () => {
    const { clientForSignIn } = await signedIn()

    await clientForSignIn(SCHOOL_A).get('/auth/profile')

    const sent = network.requestsTo(SCHOOL_A)
    expect(sent.map((request) => request.path)).toEqual(['/auth/profile', '/auth/profile'])
    expect(sent.at(-1)!.token).toBe('access-owner-a')

    // Not a default address, and not the other school: the transport knows one
    // server and cannot be pointed at another.
    expect(network.strays).toEqual([])
    expect(network.requestsTo(SCHOOL_B)).toEqual([])
  })

  it('speaks to a server nothing is connected to yet, with no token at all', async () => {
    const { clientForSignIn } = await import('../connections')

    await expect(clientForSignIn(SCHOOL_B).get('/auth/profile')).rejects.toMatchObject({
      name: 'HttpError',
      status: 401,
    })

    expect(network.requestsTo(SCHOOL_B).at(-1)!.token).toBeNull()
    expect(network.strays).toEqual([])
  })

  it('a refusal marks that connection as needing a sign-in rather than ending anything', async () => {
    const { connections, clientForSignIn } = await signedIn()
    network.server(SCHOOL_A).expired = true

    await expect(clientForSignIn(SCHOOL_A).get('/auth/profile')).rejects.toMatchObject({
      name: 'HttpError',
      status: 401,
    })

    const connection = connections.connections.value[0]!
    expect(connection.needsSignIn).toBe(true)

    // The connection itself is kept: what is on the device stays readable.
    expect(connection.ownerId).toBe('owner-a')
  })
})
