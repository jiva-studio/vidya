import { AsyncLocalStorage } from 'node:async_hooks'

import { UserId } from '@vidya/domain'

/**
 * What a sync push knows about a write that a REST request does not.
 *
 * The journal has exactly one writer — the subscriber (Д-2). A push therefore
 * cannot write its own journal row to carry the device's HLC; it leaves the
 * three facts here instead, and the subscriber picks them up while running
 * inside the same transaction.
 */
export interface SyncWriteContext {
  /** The HLC the device stamped. Absent for REST writes; the server stamps then. */
  hlc: string
  /** The device that pushed. `null` is not valid here — omit the context instead. */
  deviceId: string
  authorId: UserId | null
}

const storage = new AsyncLocalStorage<SyncWriteContext>()

/**
 * Runs `work` with the push's identity attached, so the journal row it causes
 * carries the device's HLC rather than a server stamp.
 *
 * The scope is the async call, not a request or a transaction: nesting is safe
 * and the context cannot outlive the work that set it.
 */
export const withSyncWriteContext = <T>(context: SyncWriteContext, work: () => T): T =>
  storage.run(context, work)

/** The push's identity, or `undefined` when the write came in over REST. */
export const currentSyncWriteContext = (): SyncWriteContext | undefined => storage.getStore()
