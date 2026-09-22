/**
 * Bytes under a key, in IndexedDB.
 *
 * Knows nothing about this app: the database name, the store and the key are
 * given by the caller. It exists because a browser has no filesystem, and the
 * one thing that has to outlive a page here is a file — the SQLite image.
 *
 * Every operation opens its own connection, runs one transaction and closes
 * it. A connection held open across awaits is a connection that blocks the
 * next version change and outlives the page that opened it; nobody above this
 * file has to think about that.
 *
 * Needs a global `indexedDB` — a browser, a worker, or a polyfill.
 */

/** Adds the store to an existing database, which takes a version bump. */
function addStore(dbName: string, storeName: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version + 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName)
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Opens the database, with the store guaranteed to exist.
 *
 * Without a version first, deliberately: asking for version 1 outright fails
 * on a database that is already past it, and the app cannot know which version
 * a handset it has never seen is holding.
 */
export function openDatabase(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName)

    request.onupgradeneeded = () => {
      // There was no database at all: it is created with the store in place.
      const db = request.result
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName)
    }

    request.onsuccess = () => {
      const db = request.result
      if (db.objectStoreNames.contains(storeName)) {
        resolve(db)
        return
      }

      db.close()
      addStore(dbName, storeName, db.version).then(resolve, reject)
    }

    request.onerror = () => reject(request.error)
  })
}

/** The bytes stored under `key`, or `undefined` when nothing is stored there. */
export async function readBytes(
  dbName: string,
  storeName: string,
  key: string,
): Promise<Uint8Array | undefined> {
  const db = await openDatabase(dbName, storeName)

  try {
    return await new Promise<Uint8Array | undefined>((resolve, reject) => {
      const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key)

      request.onsuccess = () => resolve(asBytes(request.result))
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

/** Writes `data` under `key`, replacing whatever was there. */
export async function writeBytes(
  dbName: string,
  storeName: string,
  key: string,
  data: Uint8Array,
): Promise<void> {
  const db = await openDatabase(dbName, storeName)

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite')

      // Its own copy: a view onto a larger buffer — the wasm heap, say — is
      // cloned whole by the structured clone the store performs.
      transaction.objectStore(storeName).put(data.slice(), key)

      // The write is done when the transaction completes, not when `put`
      // answers: a caller told otherwise would believe bytes are durable that
      // a failing transaction is about to roll back.
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}

/** What comes back is a `Uint8Array` in some implementations and a buffer in others. */
function asBytes(value: unknown): Uint8Array | undefined {
  if (value === undefined || value === null) return undefined
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)

  throw new TypeError('the stored value is not bytes')
}
