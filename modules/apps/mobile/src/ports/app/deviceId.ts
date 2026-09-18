import type { Id } from '@vidya/domain'

/**
 * Identifies one installation of the app.
 *
 * It is not a user and not a phone: restoring a backup onto a second handset
 * must not hand that handset the same id, because the id is the last
 * tie-breaker in a Hybrid Logical Clock and part of the idempotency key
 * `(collection, docId, hlc)`. Two installations sharing one id can mint the
 * same stamp for two different changes, and the server's unique index would
 * then swallow the second as an already-applied repeat — a lost write wearing
 * the costume of a successful retry.
 */
export type DeviceId = Id<'Device'>

/** Where the stable per-installation id comes from. */
export interface IDeviceId {
  /**
   * The id of this installation, minting and storing one on first call.
   *
   * Stable across launches and offline by construction: it is read from local
   * storage, never fetched.
   */
  current(): Promise<DeviceId>
}
