import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Opening the device database: where it may be opened, and what may stop it.
 *
 * Both cases here are about the same thing — an adapter that had never been
 * executed, so nothing had ever checked what it does at the edges. The plugin
 * and the platform are mocked because neither exists off a device; everything
 * between them is the real factory.
 */
const platform = { value: 'ios' }

const connection = {
  open: vi.fn(async () => undefined),
  run: vi.fn(async () => ({ changes: { changes: 0 } })),
}

const sqlite = {
  checkConnectionsConsistency: vi.fn(async () => ({ result: true })),
  isConnection: vi.fn(async () => ({ result: false })),
  closeConnection: vi.fn(async () => undefined),
  createConnection: vi.fn(async () => connection),
}

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => platform.value } }))

vi.mock('@capacitor-community/sqlite', () => ({
  CapacitorSQLite: {},
  SQLiteConnection: class {
    checkConnectionsConsistency = sqlite.checkConnectionsConsistency
    isConnection = sqlite.isConnection
    closeConnection = sqlite.closeConnection
    createConnection = sqlite.createConnection
  },
}))

const { useCapacitorSqlPersistence } = await import('../capacitor/useCapacitorSqlPersistence')

describe('opening the device database', () => {
  beforeEach(() => {
    platform.value = 'ios'
    connection.run.mockReset().mockResolvedValue({ changes: { changes: 0 } })
    connection.open.mockClear()
  })

  it('R4: refuses a platform where the database would live in memory', async () => {
    // On the web this plugin keeps the database in memory until `initWebStore`
    // and `saveToStore` are wired up, and this app wires up neither. Opening
    // there would work, answer every query, and lose everything on reload
    // without an error — which is the one outcome a student must never get.
    platform.value = 'web'

    await expect(useCapacitorSqlPersistence().open('vidya')).rejects.toThrow(/native platform/)
    expect(connection.open).not.toHaveBeenCalled()
  })

  it('opens on a device', async () => {
    const db = await useCapacitorSqlPersistence().open('vidya')

    expect(connection.open).toHaveBeenCalledTimes(1)
    expect(db).toBeDefined()
  })

  it('R5: starts even when the busy timeout is refused', async () => {
    // The timeout decides whether a rare collision waits three seconds or
    // reports "database is locked". It went through a statement parser that
    // can refuse it, and the refusal took `open` down — and with `open`, the
    // launch. An optimisation must not be able to stop the app starting.
    connection.run.mockRejectedValue(new Error('not a statement this plugin parses'))

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const db = await useCapacitorSqlPersistence().open('vidya')

    expect(db).toBeDefined()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
