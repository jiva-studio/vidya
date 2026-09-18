import { pgClientConfig, testDatabase } from '@vidya/api/shared/datasources'
import { runMigrations } from '@vidya/api/shared/migrations'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Client } from 'pg'

/**
 * What only a real Postgres can prove.
 *
 * The suite that runs everywhere stubs `pg_advisory_lock` out, because pg-mem
 * has one session and nothing to serialise. That makes the runner's central
 * safety property — two processes cannot apply the same migration at once —
 * untested by construction there. These cases close that gap, and are skipped
 * unless VIDYA_TEST_DB=postgres.
 */
const describeOnPostgres = testDatabase() === 'postgres' ? describe : describe.skip

describeOnPostgres('runMigrations against Postgres', () => {
  const dirs: string[] = []
  const clients: Client[] = []

  const connect = async (): Promise<Client> => {
    const client = new Client(pgClientConfig(migrationDb))
    await client.connect()
    clients.push(client)
    return client
  }

  const migrationDb = `vidya_migrations_${process.env.JEST_WORKER_ID ?? '0'}`

  const migrations = (files: Record<string, string>): string => {
    const dir = mkdtempSync(join(tmpdir(), 'vidya-pg-migrations-'))
    for (const [name, sql] of Object.entries(files)) writeFileSync(join(dir, name), sql)
    dirs.push(dir)
    return dir
  }

  beforeAll(async () => {
    const admin = new Client(pgClientConfig('postgres'))
    await admin.connect()
    await admin.query(`DROP DATABASE IF EXISTS "${migrationDb}"`)
    await admin.query(`CREATE DATABASE "${migrationDb}"`)
    await admin.end()
  })

  beforeEach(async () => {
    const client = await connect()
    await client.query('DROP SCHEMA IF EXISTS public CASCADE')
    await client.query('CREATE SCHEMA public')
  })

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((c) => c.end()))
  })

  afterAll(() => {
    dirs.forEach((d) => rmSync(d, { recursive: true, force: true }))
  })

  it('applies real DDL and records it', async () => {
    const dir = migrations({
      '001_first.sql': 'CREATE TABLE widgets (id uuid PRIMARY KEY DEFAULT gen_random_uuid())',
    })
    const client = await connect()

    const applied = await runMigrations(client, dir)

    expect(applied).toEqual(['001_first.sql'])
    const { rows } = await client.query('SELECT name FROM schema_migrations')
    expect(rows.map((r) => r.name)).toEqual(['001_first.sql'])
  })

  it('leaves nothing behind when a migration fails midway', async () => {
    const dir = migrations({
      '001_ok.sql': 'CREATE TABLE kept (id int)',
      '002_bad.sql': 'CREATE TABLE half (id int); CREATE TABLE half (id int);',
    })
    const client = await connect()

    await expect(runMigrations(client, dir)).rejects.toThrow(/002_bad\.sql/)

    const kept = await client.query("SELECT to_regclass('public.kept') AS t")
    const half = await client.query("SELECT to_regclass('public.half') AS t")
    expect(kept.rows[0].t).toBe('kept')

    // The failing file ran two statements; without a per-file transaction the first would survive.
    expect(half.rows[0].t).toBeNull()
  })

  it('serialises two runners so a migration is never applied twice', async () => {
    // pg-mem's advisory lock is a stub that always succeeds, so only postgres proves this.
    const dir = migrations({
      '001_once.sql': 'CREATE TABLE only_once (id int)',
    })

    const [first, second] = await Promise.all([connect(), connect()])
    const results = await Promise.all([runMigrations(first, dir), runMigrations(second, dir)])

    // Whichever got the lock applied it; the other waited, then found it done.
    const appliedCounts = results.map((r) => r.length).sort()
    expect(appliedCounts).toEqual([0, 1])

    const client = await connect()
    const { rows } = await client.query('SELECT name FROM schema_migrations')
    expect(rows).toHaveLength(1)
  })

  it('releases the lock after a failure, so the next run is not blocked', async () => {
    const failing = migrations({ '001_bad.sql': 'CREATE TABLE bad (id int NOT A TYPE)' })
    const working = migrations({ '001_good.sql': 'CREATE TABLE good (id int)' })

    const first = await connect()
    await expect(runMigrations(first, failing)).rejects.toThrow()

    // A leaked session lock would hang this call rather than fail it.
    const second = await connect()
    await expect(runMigrations(second, working)).resolves.toEqual(['001_good.sql'])
  })
})
