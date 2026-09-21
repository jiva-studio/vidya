import { Preferences } from '@capacitor/preferences'
import type { DeviceId, IDeviceId } from '@vidya/client'
import { asId } from '@vidya/domain'

const KEY = 'device-id'

/**
 * The installation's stable id, minted once and kept in the platform store.
 *
 * Minted with `crypto.randomUUID()` rather than anything derived from the
 * handset. The id is the last tiebreak in a Hybrid Logical Clock and part of
 * the idempotency key `(collection, docId, hlc)`, so two installations sharing
 * one id can mint the same stamp for two different changes and have the second
 * swallowed by the server's unique index as an imagined repeat. A
 * hardware identifier would survive a backup restored onto a second handset and
 * produce exactly that; a random one does not.
 *
 * It is not a user and not a device fingerprint: it identifies this install of
 * this app, it never leaves the sync protocol, and clearing the app's data
 * mints a new one, which is correct — that install's history is gone with it.
 */
export class PreferencesDeviceId implements IDeviceId {
  private cached: DeviceId | null = null

  async current(): Promise<DeviceId> {
    if (this.cached !== null) return this.cached

    const { value } = await Preferences.get({ key: KEY })
    if (value) {
      this.cached = asId<DeviceId>(value)
      return this.cached
    }

    const minted = asId<DeviceId>(crypto.randomUUID())
    await Preferences.set({ key: KEY, value: minted })
    this.cached = minted

    return minted
  }
}
