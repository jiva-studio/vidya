import type { IDatabase } from '@vidya/client'
import type { SyncEngine } from '@vidya/client'

import { connectionStore, useConnections } from './connections'
import { useOutboxView } from './outboxView'
import { startSync } from './sync'
import { useSyncStatus } from './syncStatus'

/**
 * Starting the engines the app holds connections for, at launch.
 *
 * This is where the local layer stops being dead code: without a caller here
 * the database, the repositories and the outbox ship and never run.
 *
 * Each connection gets its own engine and its own first run. The run is not
 * awaited — the screens read the device, and what is already on it must not
 * wait behind a network call.
 */
export async function startDeviceSync(db: IDatabase): Promise<void> {
  const outbox = useOutboxView()
  const status = useSyncStatus()

  for (const connection of useConnections().connections.value) {
    const started = await startSync({ db, connection, connections: connectionStore })

    outbox.track(connection.ownerId, started.engine.outbox)
    if (await hasSynced(started.engine)) status.markFilled()

    void started.triggers.now()
  }
}

/**
 * Whether this device has ever read anything from this server.
 *
 * A scope position is written only by a run that applied a page, and it
 * outlives the launch it was written in — so its presence is the difference
 * between "nothing has arrived yet" and "everything arrived last week". The
 * screens ask a different question of each.
 */
export async function hasSynced(engine: SyncEngine): Promise<boolean> {
  const scopes = await engine.state.listScopes()
  return scopes.length > 0
}
