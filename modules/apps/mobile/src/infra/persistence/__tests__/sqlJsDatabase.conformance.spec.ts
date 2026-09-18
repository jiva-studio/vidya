import { useSqlJsPersistence } from '../sqljs'
import { describeDatabaseConformance } from './databaseConformance'

/**
 * The port's promises, checked against the adapter the whole suite runs on.
 *
 * This lane is the fast one and the one CI always has. It cannot show what only
 * a device shows — a rollback that fails, a plugin that parses our DDL — which
 * is why the same suite is also pointed at the Capacitor adapter.
 */
describeDatabaseConformance({
  name: 'sql.js',
  async create() {
    const images = new Map<string, Uint8Array>()
    const persistence = useSqlJsPersistence({ images })

    return { open: () => persistence.open('conformance') }
  },
})
