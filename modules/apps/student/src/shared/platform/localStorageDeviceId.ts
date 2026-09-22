import type { DeviceId, IDeviceId } from '@vidya/client'
import { asId } from '@vidya/domain'

const KEY = 'vidya.student.deviceId'

/**
 * This browser's installation id, minted once and kept in local storage.
 *
 * Minted with `crypto.randomUUID()` rather than derived from anything about
 * the machine. The id is the last tiebreak in a Hybrid Logical Clock and part
 * of the idempotency key `(collection, docId, hlc)`, so two installations
 * sharing one id can mint the same stamp for two different changes and have
 * the second swallowed by the server's unique index as an imagined repeat.
 *
 * Clearing the browser's storage mints a new one, which is correct: the local
 * database went with it, and this is a new installation.
 */
export class LocalStorageDeviceId implements IDeviceId {
  private cached: DeviceId | null = null

  async current(): Promise<DeviceId> {
    if (this.cached !== null) return this.cached

    const stored = window.localStorage.getItem(KEY)
    if (stored) {
      this.cached = asId<DeviceId>(stored)
      return this.cached
    }

    const minted = asId<DeviceId>(crypto.randomUUID())
    window.localStorage.setItem(KEY, minted)
    this.cached = minted

    return minted
  }
}
