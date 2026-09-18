import { pgClientConfig, testDatabase } from '@vidya/api/shared/datasources'
import { appendJournalRow } from '@vidya/api/sync'
import { SchoolId } from '@vidya/domain'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Client } from 'pg'
import { EntityManager } from 'typeorm'
import { v4 as uuid } from 'uuid'

/**
 * What only a real Postgres can prove about the journal.
 *
 * The whole of is a disagreement between two orders — the order `BIGSERIAL`
 * hands out numbers and the order transactions become visible. pg-mem has one
 * session and no MVCC, so there is no disagreement to observe there and these
 * cases would pass while proving nothing. They run under
 * `VIDYA_TEST_DB=postgres` (`make test-postgres`).
 */
const describeOnPostgres = testDatabase() === 'postgres' ? describe : describe.skip

const JOURNAL_SQL = join(__dirname, '..', '..', '..', '..', 'migrations', '019_sync_journal.sql')

/**
 * A `pg.Client` dressed as the `EntityManager` the writer takes.
 *
 * `appendJournalRow` uses exactly one thing from a manager — `query` — and
 * these cases need a session per transaction, which a shared TypeORM data
 * source will not give. Going through the real function rather than a copy of
 * it is the whole point: a test that took the lock itself would prove what
 * Postgres does, not what Vidya does.
 */
const managerFor = (client: Client): EntityManager =>
  ({
    query: async (sql: string, params?: unknown[]) => (await client.query(sql, params)).rows,
  }) as unknown as EntityManager

describeOnPostgres('sync journal under concurrency', () => {
  const database = `vidya_journal_${process.env.JEST_WORKER_ID ?? '0'}`
  const clients: Client[] = []

  const connect = async (): Promise<Client> => {
    const client = new Client(pgClientConfig(database))
    await client.connect()
    clients.push(client)
    return client
  }

  /** Appends through the production writer and reports the number it was given. */
  const append = async (client: Client, scopeId: string, hlc: string): Promise<string> => {
    const docId = uuid()

    await appendJournalRow(managerFor(client), {
      collection: 'homework',
      docId,
      op: 'upsert',
      data: {},
      hlc,
      scopeKind: 'user',
      scopeId,
      schoolId: scopeId as SchoolId,
      deviceId: null,
      authorId: null,
    })

    const { rows } = await client.query(
      'SELECT global_seq FROM sync_journal WHERE collection = $1 AND doc_id = $2 AND hlc = $3',
      ['homework', docId, hlc],
    )

    return String(rows[0].global_seq)
  }

  /** What a device sees when it pulls: committed rows only, in cursor order. */
  const pull = async (client: Client, cursor: string): Promise<{ seq: string; hlc: string }[]> => {
    const { rows } = await client.query(
      'SELECT global_seq, hlc FROM sync_journal WHERE global_seq > $1 ORDER BY global_seq',
      [cursor],
    )
    return rows.map((r) => ({ seq: String(r.global_seq), hlc: r.hlc }))
  }

  beforeAll(async () => {
    const admin = new Client(pgClientConfig('postgres'))
    await admin.connect()
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`)
    await admin.query(`CREATE DATABASE "${database}"`)
    await admin.end()
  })

  beforeEach(async () => {
    const setup = await connect()
    await setup.query('DROP SCHEMA IF EXISTS public CASCADE')
    await setup.query('CREATE SCHEMA public')
    await setup.query(readFileSync(JOURNAL_SQL, 'utf8'))
  })

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((c) => c.end()))
  })

  /* ------------------------------ -------------------------------- */

  it('a row committed late is never stranded below an advanced cursor', async () => {
    const scope = uuid()
    const [slow, fast, reader] = await Promise.all([connect(), connect(), connect()])

    // The slow writer takes its number and stays open. This is the transaction
    // loses: a lower number that only becomes visible later.
    await slow.query('BEGIN')
    const slowSeq = Number(await append(slow, scope, '000001700000000001-000000-slow'))

    // A whole competing transaction, begin to commit, running on its own. Under
    // the lock it cannot get past taking a number and stays pending here; take
    // the lock away and it commits immediately, ahead of the slow one.
    const fastDone = (async () => {
      await fast.query('BEGIN')
      const seq = Number(await append(fast, scope, '000001700000000002-000000-fast'))
      await fast.query('COMMIT')
      return seq
    })()

    await new Promise((resolve) => setTimeout(resolve, 300))

    // What a device pulling right now sees, and what it therefore sets its
    // cursor to. Everything below that cursor is gone for good.
    const midway = await pull(reader, '0')
    const cursor = midway.length ? midway[midway.length - 1].seq : '0'

    await slow.query('COMMIT')
    const fastSeq = await fastDone

    const after = await pull(reader, cursor)
    const delivered = [...midway, ...after].map((r) => Number(r.seq)).sort((a, b) => a - b)

    // Both rows reached the device. Without the lock the fast transaction
    // commits first holding the higher number, the device advances past it, and
    // the slow row — a student's homework — is never delivered at all.
    expect(delivered).toEqual([slowSeq, fastSeq].sort((a, b) => a - b))

    // And the reason it works: the second writer could not even take a number
    // while the first was open, so number order is commit order.
    expect(midway).toEqual([])
    expect(slowSeq).toBeLessThan(fastSeq)
  })

  it('the row a reader already saw is never re-ordered behind a later one', async () => {
    const scope = uuid()
    const [first, second, reader] = await Promise.all([connect(), connect(), connect()])

    await first.query('BEGIN')
    const firstSeq = await append(first, scope, '000001700000000001-000000-a')
    await first.query('COMMIT')

    const seen = await pull(reader, '0')
    expect(seen.map((r) => r.seq)).toEqual([String(firstSeq)])

    await second.query('BEGIN')
    const secondSeq = await append(second, scope, '000001700000000002-000000-b')
    await second.query('COMMIT')

    const next = await pull(reader, seen[0].seq)
    expect(next.map((r) => r.seq)).toEqual([String(secondSeq)])
  })

  /* ------------------------------ -------------------------------- */

  it('a device pulling throughout a hundred concurrent pushes misses none', async () => {
    const scope = uuid()

    // Twenty-five sessions, four transactions each: a hundred pushes racing,
    // without asking the server for a hundred connections at once.
    const writers = await Promise.all(Array.from({ length: 25 }, () => connect()))
    const reader = await connect()

    let writing = true
    const seen: number[] = []

    // A device syncing while the pushes land — the only way to catch a row that
    // is committed below an already-advanced cursor. A reader that waits for
    // quiet at the end sees a tidy table and proves nothing.
    const polling = (async () => {
      let cursor = '0'
      for (;;) {
        const page = await pull(reader, cursor)
        page.forEach((row) => seen.push(Number(row.seq)))
        if (page.length) cursor = page[page.length - 1].seq
        else if (!writing) return
        await new Promise((resolve) => setTimeout(resolve, 5))
      }
    })()

    await Promise.all(
      writers.map(async (client, index) => {
        for (let round = 0; round < 4; round += 1) {
          await client.query('BEGIN')
          const hlc = `0000017000000${String(index).padStart(3, '0')}${String(round)}-000000-w`
          await append(client, scope, hlc)
          await client.query('COMMIT')
        }
      }),
    )

    writing = false
    await polling

    // Nothing delivered twice, nothing skipped, and the cursor only ever moved
    // forward — which is the same statement as "no holes in commit order".
    expect(new Set(seen).size).toBe(100)
    expect(seen).toHaveLength(100)
    expect([...seen].sort((a, b) => a - b)).toEqual(seen)
  })

  it('a cursor walked forward one page at a time sees every row exactly once', async () => {
    const scope = uuid()
    const writers = await Promise.all(Array.from({ length: 20 }, () => connect()))

    await Promise.all(
      writers.map(async (client, index) => {
        await client.query('BEGIN')
        await append(client, scope, `000001700000001${String(index).padStart(3, '0')}-000000-w`)
        await client.query('COMMIT')
      }),
    )

    const reader = await connect()
    const seen: string[] = []
    let cursor = '0'

    for (;;) {
      const { rows } = await reader.query(
        'SELECT global_seq FROM sync_journal WHERE global_seq > $1 ORDER BY global_seq LIMIT 3',
        [cursor],
      )
      if (rows.length === 0) break
      rows.forEach((r) => seen.push(String(r.global_seq)))
      cursor = String(rows[rows.length - 1].global_seq)
    }

    expect(seen).toHaveLength(20)
    expect(new Set(seen).size).toBe(20)
  })

  /* ------------------------------ -------------------------------- */

  it('a long transaction elsewhere does not delay reading the journal', async () => {
    const scope = uuid()
    const [writer, hog, reader] = await Promise.all([connect(), connect(), connect()])

    await hog.query('CREATE TABLE reports (id int)')

    // The rejected cure reads the journal only below
    // `pg_snapshot_xmin(pg_current_snapshot())`. That horizon is held down by
    // ANY open transaction in ANY table, so this two-statement stand-in for an
    // admin report would hide the journal from every device for as long as it
    // ran. Committed rows must be readable regardless of what else is open.
    await hog.query('BEGIN')
    await hog.query('INSERT INTO reports (id) VALUES (1)')

    await writer.query('BEGIN')
    await append(writer, scope, '000001700000002000-000000-w')
    await writer.query('COMMIT')

    const visible = await pull(reader, '0')

    expect(visible).toHaveLength(1)

    await hog.query('ROLLBACK')
  })

  it('the horizon the rejected cure reads below would hide a delivered row', async () => {
    const scope = uuid()
    const [writer, hog, reader] = await Promise.all([connect(), connect(), connect()])

    await hog.query('CREATE TABLE reports (id int)')

    // The admin report again, but this time we measure what it costs. While it
    // is open the snapshot horizon sits below every transaction started since,
    // so a journal read gated on that horizon returns nothing at all.
    await hog.query('BEGIN')
    await hog.query('INSERT INTO reports (id) VALUES (1)')

    await writer.query('BEGIN')
    const seq = await append(writer, scope, '000001700000003000-000000-w')
    await writer.query('COMMIT')

    // What would have delivered: committed rows whose writing transaction
    // is already below the horizon of every session still running.
    const { rows: gated } = await reader.query(
      `SELECT global_seq FROM sync_journal
        WHERE xmin::text::bigint < pg_snapshot_xmin(pg_current_snapshot())::text::bigint
        ORDER BY global_seq`,
    )

    // Nothing. The row is committed, correct and addressed to a waiting device,
    // and the horizon holds it back for as long as an unrelated report runs.
    expect(gated).toHaveLength(0)

    // What the journal actually delivers, at the same moment, same session.
    expect((await pull(reader, '0')).map((row) => row.seq)).toEqual([seq])

    await hog.query('ROLLBACK')
  })
})
