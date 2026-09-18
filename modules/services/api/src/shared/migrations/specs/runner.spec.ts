import { MigrationClient, runMigrations } from '@vidya/api/shared/migrations'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * Records every statement it is asked to run, so the tests can assert on the
 * shape of the session — lock, transaction boundaries, order — and not just on
 * the end state. `failOn` makes one statement throw, which is how the rollback
 * and lock-release paths are reached.
 */
class RecordingClient implements MigrationClient {
  readonly statements: string[] = []
  private readonly applied: string[] = []

  constructor(private readonly failOn?: RegExp) {}

  async query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
    this.statements.push(sql.trim())
    if (this.failOn?.test(sql)) throw new Error('boom')
    if (/SELECT name FROM schema_migrations/i.test(sql)) {
      return { rows: this.applied.map((name) => ({ name })) as T[] }
    }
    if (/INSERT INTO schema_migrations/i.test(sql)) {
      this.applied.push(String(params?.[0]))
    }
    return { rows: [] }
  }

  /** Names recorded as applied, in the order they were applied. */
  get appliedNames(): string[] {
    return [...this.applied]
  }
}

const withMigrations = (files: Record<string, string>): string => {
  const dir = mkdtempSync(join(tmpdir(), 'vidya-migrations-'))
  for (const [name, sql] of Object.entries(files)) writeFileSync(join(dir, name), sql)
  return dir
}

describe('runMigrations', () => {
  const dirs: string[] = []
  const migrations = (files: Record<string, string>) => {
    const dir = withMigrations(files)
    dirs.push(dir)
    return dir
  }

  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })))

  it('applies files in lexical order, not in directory order', async () => {
    const dir = migrations({
      '010_third.sql': 'CREATE TABLE c ()',
      '002_second.sql': 'CREATE TABLE b ()',
      '001_first.sql': 'CREATE TABLE a ()',
    })
    const client = new RecordingClient()

    await runMigrations(client, dir)

    expect(client.appliedNames).toEqual(['001_first.sql', '002_second.sql', '010_third.sql'])
  })

  it('is idempotent: a second run applies nothing', async () => {
    const dir = migrations({ '001_first.sql': 'CREATE TABLE a ()' })
    const client = new RecordingClient()

    await runMigrations(client, dir)
    const afterFirst = client.appliedNames.length
    await runMigrations(client, dir)

    expect(afterFirst).toBe(1)
    expect(client.appliedNames).toEqual(['001_first.sql'])
  })

  it('wraps each migration in its own transaction', async () => {
    const dir = migrations({
      '001_first.sql': 'CREATE TABLE a ()',
      '002_second.sql': 'CREATE TABLE b ()',
    })
    const client = new RecordingClient()

    await runMigrations(client, dir)

    expect(client.statements.filter((s) => s === 'BEGIN')).toHaveLength(2)
    expect(client.statements.filter((s) => s === 'COMMIT')).toHaveLength(2)
  })

  it('rolls back the failing migration and leaves earlier ones applied', async () => {
    const dir = migrations({
      '001_first.sql': 'CREATE TABLE a ()',
      '002_second.sql': 'CREATE TABLE boom ()',
    })
    const client = new RecordingClient(/CREATE TABLE boom/)

    await expect(runMigrations(client, dir)).rejects.toThrow(/002_second\.sql/)

    expect(client.appliedNames).toEqual(['001_first.sql'])
    expect(client.statements).toContain('ROLLBACK')
  })

  it('takes a session advisory lock and releases it', async () => {
    const dir = migrations({ '001_first.sql': 'CREATE TABLE a ()' })
    const client = new RecordingClient()

    await runMigrations(client, dir)

    expect(client.statements.some((s) => /pg_advisory_lock/.test(s))).toBe(true)
    expect(client.statements.some((s) => /pg_advisory_unlock/.test(s))).toBe(true)
  })

  it('releases the lock even when a migration throws', async () => {
    const dir = migrations({ '001_first.sql': 'CREATE TABLE boom ()' })
    const client = new RecordingClient(/CREATE TABLE boom/)

    await expect(runMigrations(client, dir)).rejects.toThrow()

    expect(client.statements.some((s) => /pg_advisory_unlock/.test(s))).toBe(true)
  })

  it('fails loudly when the directory holds no migrations', async () => {
    const dir = migrations({})
    const client = new RecordingClient()

    await expect(runMigrations(client, dir)).rejects.toThrow(/no migrations/i)
  })

  it('fails loudly when the directory does not exist', async () => {
    const client = new RecordingClient()

    await expect(runMigrations(client, '/nonexistent/vidya/migrations')).rejects.toThrow(
      /migrations/i,
    )
  })

  it('ignores files that are not .sql', async () => {
    const dir = migrations({
      '001_first.sql': 'CREATE TABLE a ()',
      'README.md': 'not a migration',
    })
    const client = new RecordingClient()

    await runMigrations(client, dir)

    expect(client.appliedNames).toEqual(['001_first.sql'])
  })
})
