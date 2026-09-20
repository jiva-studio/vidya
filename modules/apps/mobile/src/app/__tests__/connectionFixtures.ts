import type { UserId } from '@vidya/domain'
import { asId } from '@vidya/domain'

import type { Connection, IConnectionStore } from '@/ports'
import { normaliseBaseUrl } from '@/ports'

import type { ServerStub } from './fakeSyncNetwork'

/** A connection holding the identity a {@link ServerStub} answers for. */
export const connectionTo = (baseUrl: string, server: ServerStub): Connection => ({
  baseUrl: normaliseBaseUrl(baseUrl),
  ownerId: asId<UserId>(server.ownerId),
  session: { accessToken: server.accessToken, refreshToken: server.refreshToken },
  needsSignIn: false,
})

/**
 * The registry, in memory.
 *
 * Kept separate from the persisted one on purpose: the engine tests are about
 * what the engine does with a connection, and a test that fails because
 * Preferences was mocked wrongly says nothing about that.
 */
export function inMemoryConnectionStore(initial: readonly Connection[] = []): IConnectionStore {
  let rows = [...initial]

  return {
    list: () => Promise.resolve([...rows]),
    add: (connection) => {
      rows = [...rows.filter((row) => row.baseUrl !== connection.baseUrl), connection]
      return Promise.resolve()
    },
    update: (baseUrl, changes) => {
      rows = rows.map((row) => (row.baseUrl === baseUrl ? { ...row, ...changes } : row))
      return Promise.resolve()
    },
    remove: (baseUrl) => {
      rows = rows.filter((row) => row.baseUrl !== baseUrl)
      return Promise.resolve()
    },
  }
}
