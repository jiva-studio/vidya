import type { StorageDurability } from '@/shared/status'

/**
 * Asks the browser to keep the local database rather than evict it.
 *
 * Without this, storage written by a script is fair game: a browser short of
 * room may clear IndexedDB, and the outbox goes with it — work the student
 * saved and the server has never seen. Safari removes script-written storage
 * after seven days without a visit whatever the answer here, so the site has
 * to survive an empty database as an ordinary first run in any case.
 *
 * A refusal is not a failure and gets no error screen: the site works exactly
 * as before, with a weaker promise about how long the data lives, and the
 * settings screen says which promise was given.
 */
export const requestPersistentStorage = async (
  manager: StorageManager | undefined = globalThis.navigator?.storage,
): Promise<StorageDurability> => {
  if (typeof manager?.persist !== 'function') return 'unknown'

  try {
    return (await manager.persist()) ? 'persistent' : 'temporary'
  } catch (error) {
    // A browser that throws here has told us nothing about what it will keep,
    // which is exactly what 'unknown' says.
    console.warn('the browser refused to answer about persistent storage', error)
    return 'unknown'
  }
}
