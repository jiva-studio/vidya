import type { HttpClient, IDatabase, SyncEngine } from '@vidya/client'
import type { Connection } from '@vidya/client'
import { createHttpSyncClient, createSyncEngine } from '@vidya/client'
import { toIsoDateTime } from '@vidya/domain'
import { watch } from 'vue'

import { useConnection } from '@/shared/connection'
import { type INetworkStatus, LocalStorageDeviceId } from '@/shared/platform'
import { useSiteStatus } from '@/shared/status'
import { useSyncRuns } from '@/shared/sync'

import { renewSession } from './connection'

/**
 * Where the sync engine is wired into the running site, and when it runs.
 *
 * Only the writing tab reaches here: the engine writes, and a second tab
 * writing the same image would publish its own copy over this one.
 *
 * There is one engine, because there is one connection (a browser is open on
 * one origin). It runs at start-up and whenever the network comes back —
 * a tab has no background to be woken in, so those are the triggers there are.
 * A run with no network is not attempted at all: the answer would be a request
 * that cannot leave, and the engine's retry policy would count it as the
 * server being unreachable.
 */

export interface SiteSyncOptions {
  readonly db: IDatabase
  readonly http: HttpClient
  readonly network: INetworkStatus
}

interface RunningSync {
  readonly engine: SyncEngine
  stop(): void
}

/**
 * Keeps an engine running for as long as somebody is signed in.
 *
 * Signing in happens after start-up, so the engine cannot be started once and
 * forgotten: the connection appears when the code is accepted, and it is
 * replaced — with another identity — when somebody else signs in on the same
 * machine. Every change tears the old engine down before the new one starts,
 * because two engines over one database would write each other's pages.
 */
export const syncWithConnection = (options: SiteSyncOptions): (() => void) => {
  let running: RunningSync | undefined
  let queue: Promise<void> = Promise.resolve()

  const swap = async (connection: Connection | undefined): Promise<void> => {
    running?.stop()
    running = undefined
    if (connection === undefined) return

    running = await startSiteSync(options, connection)
  }

  const unwatch = watch(
    useConnection().connection,
    (connection) => {
      // Serialised: a sign-in followed at once by another must not leave two
      // engines started in the order their set-up happened to finish.
      queue = queue.then(() => swap(connection))
    },
    { immediate: true },
  )

  return () => {
    unwatch()
    running?.stop()
    running = undefined
  }
}

const startSiteSync = async (
  options: SiteSyncOptions,
  connection: Connection,
): Promise<RunningSync> => {
  const { db, http, network } = options
  const status = useSiteStatus()
  const deviceId = new LocalStorageDeviceId()

  const engine = createSyncEngine({
    db,
    client: createHttpSyncClient({ http }),
    deviceId: () => deviceId.current(),
    ownerId: () => connection.ownerId,
    now: () => toIsoDateTime(new Date()),
    nowMs: () => Date.now(),
    random: () => Math.random(),
    refreshToken: () => renewSession(http),
  })

  let stopped = false

  const run = async (): Promise<void> => {
    if (stopped || !network.isOnline()) return

    status.runStarted()
    const result = await engine.runner.run()
    status.runFinished(result.pull?.applied ?? 0, result.outcome === 'completed')
  }

  const offOnline = network.onOnline(() => void run())

  // Joining a school changes what the server will send, and a tab is never
  // woken in the background: without this the catalogue would arrive at the
  // next reload rather than at the moment somebody joined.
  useSyncRuns().adoptRunner(() => void run())

  // A database that already holds scope positions was filled by a run on some
  // other day: the courses are there, and the screens must not promise to
  // fetch them again before saying so.
  if (await hasSynced(engine)) status.markFilled()

  void run()

  return {
    engine,
    stop: () => {
      stopped = true
      offOnline()
      useSyncRuns().adoptRunner(undefined)
    },
  }
}

/** Whether this machine has ever read anything from the server. */
export const hasSynced = async (engine: SyncEngine): Promise<boolean> => {
  const scopes = await engine.state.listScopes()
  return scopes.length > 0
}
