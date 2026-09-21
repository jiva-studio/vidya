import { readBytes, writeBytes } from '../idb/idbKv'

/**
 * Where the SQLite image waits between opens.
 *
 * The same SQLite runs on both platforms; what differs is where its file
 * lives. On a handset the native adapter keeps it on disk by itself. In a
 * browser there is no disk: `sql.js` holds the database in memory, and the
 * image has to be put somewhere that outlives the page — or a reload starts
 * the student from nothing, with their courses still sitting on the server.
 */
export interface ImageStorage {
  read(name: string): Promise<Uint8Array | undefined>
  write(name: string, data: Uint8Array): Promise<void>
}

/** Images kept for as long as the process lives. What a test wants. */
export type ImageStore = Map<string, Uint8Array>

export const inMemoryImages = (images: ImageStore): ImageStorage => ({
  read: (name) => Promise.resolve(images.get(name)),
  write: (name, data) => {
    images.set(name, data)
    return Promise.resolve()
  },
})

/** Whether this platform has IndexedDB at all. */
export const hasIndexedDb = (): boolean => typeof indexedDB !== 'undefined'

const DATABASE = 'vidya-sqlite'
const STORE = 'images'

/**
 * Images in IndexedDB, which is the browser's disk.
 *
 * The name of the SQLite database is the key, rather than being taken apart
 * into a database, a store and a key of its own: the native adapter is handed
 * the same name, and a name shaped like a path would have to mean something
 * there too.
 *
 * A failure is reported and not raised. Reading fails on a first launch, on a
 * browser refusing storage, on a private window — and the honest answer to all
 * three is an empty device, which is what a first launch is anyway. A failed
 * write leaves the session working on a database that will not survive the
 * reload; the alternative is refusing a write SQLite has already committed.
 */
export function indexedDbImages(): ImageStorage {
  return {
    async read(name) {
      try {
        return await readBytes(DATABASE, STORE, name)
      } catch (error) {
        console.warn('sqlite: the stored image could not be read; starting empty', error)
        return undefined
      }
    },

    async write(name, data) {
      try {
        await writeBytes(DATABASE, STORE, name, data)
      } catch (error) {
        console.warn('sqlite: the image could not be stored; this session is not durable', error)
      }
    },
  }
}
