import type { IDatabase } from '@/ports'

import { connectionStore, useConnections } from './connections'
import { useOutboxView } from './outboxView'
import { startSync } from './sync'

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

  for (const connection of useConnections().connections.value) {
    const started = await startSync({ db, connection, connections: connectionStore })

    outbox.track(connection.ownerId, started.engine.outbox)
    void started.triggers.now()
  }
}
