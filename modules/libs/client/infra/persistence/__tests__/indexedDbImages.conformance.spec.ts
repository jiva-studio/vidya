import 'fake-indexeddb/auto'

import { useSqlJsPersistence } from '../sqljs'
import { describeDatabaseConformance } from './databaseConformance'

/**
 * The same promises, kept over the store the web build actually uses.
 *
 * The suite above this one runs the adapter over a map in memory, which says
 * nothing about the half that matters in a browser: the image is written to
 * IndexedDB and read back on the next launch. That half is what makes a
 * student's courses survive a reload, and it has no reader in a test unless
 * there is an `indexedDB` to talk to — hence the polyfill, which is the same
 * storage engine the browser implements, without the browser.
 *
 * Every subject gets a database name of its own, so "a store nothing has
 * written to yet" means that here too: the polyfill's storage is global, and
 * two tests sharing a key would be two tests sharing rows.
 */

let taken = 0

describeDatabaseConformance({
  name: 'sql.js over IndexedDB',
  async create() {
    const persistence = useSqlJsPersistence()
    const dbName = `conformance-${(taken += 1)}`

    return { open: () => persistence.open(dbName) }
  },
})
