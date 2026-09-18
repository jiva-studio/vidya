import { pgClientConfig, testDatabase } from '@vidya/api/shared/datasources'
import { JOURNAL_LOCK_KEY } from '@vidya/api/sync'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Client } from 'pg'
import { v4 as uuid } from 'uuid'

/**
 * What only a real Postgres can prove about the journal.
 *
 * The whole of Д-1 is a disagreement between two orders — the order `BIGSERIAL`
 * hands out numbers and the order transactions become visible. pg-mem has one
 * session and no MVCC, so there is no disagreement to observe there and these
 * cases would pass while proving nothing. They run under
 * `VIDYA_TEST_DB=postgres` (`make test-postgres`).
 */
const describeOnPostgres = testDatabase() === 'postgres' ? describe : describe.skip

const JOURNAL_SQL = join(__dirname, '..', '..', '..', '..', 'migrations', '019_sync_journal.sql')

const INSERT = `
  INSERT INTO sync_journal
    (collection, doc_id, op, data, hlc, scope_kind, scope_id, school_id, device_id, author_id)
  VALUES ('homework', $1, 'upsert', '{}'::jsonb, $2, 'user', $3, $3, NULL, NULL)
  RETURNING global_seq
`

describeOnPostgres('sync journal under concurrency', () => {
  const database = `vidya_journal_${process.env.JEST_WORKER_ID ?? '0'}`
  const clients: Client[] = []

  const connect = async (): Promise<Client> => {
    const client = new Client(pgClientConfig(database))
    await client.connect()
    clients.push(client)
    return client
  }

  /** Takes the lock and appends, exactly as `appendJournalRow` does. */
  const append = async (client: Client, scopeId: string, hlc: string): Promise<string> => {
    await client.query(`SELECT pg_advisory_xact_lock(${JOURNAL_LOCK_KEY})`)
    const { rows } = await client.query(INSERT, [uuid(), hlc, scopeId])
    return rows[0].global_seq
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

  /* ------------------------------ T-S-35 -------------------------------- */

  it('T-S-35: a row committed late is never stranded below an advanced cursor', async () => {
    const scope = uuid()
    const [slow, fast, reader] = await Promise.all([connect(), connect(), connect()])

    // The slow writer takes its number and stays open. This is the transaction
    // Д-1 loses: a lower number that only becomes visible later.
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

  it('T-S-35: the row a reader already saw is never re-ordered behind a later one', async () => {
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

  /* ------------------------------ T-S-36 -------------------------------- */

  it('T-S-36: a device pulling throughout a hundred concurrent pushes misses none', async () => {
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

  it('T-S-36: a cursor walked forward one page at a time sees every row exactly once', async () => {
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

  /* ------------------------------ T-S-41 -------------------------------- */

  it('T-S-41: a long transaction elsewhere does not delay reading the journal', async () => {
    const scope = uuid()
    const [writer, hog, reader] = await Promise.all([connect(), connect(), connect()])

    await hog.query('CREATE TABLE reports (id int)')

    // The rejected cure (И-1) reads the journal only below
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

  it('T-S-41: the journal read carries no transaction-snapshot ceiling', async () => {
    const source = readFileSync(join(__dirname, '..', 'writer.ts'), 'utf8')

    // Comments strip out, because the rejection is *documented* in this very
    // file and a naive search would trip over the explanation.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

    // A guard against a future "optimisation" that drops the advisory lock in
    // favour of the snapshot horizon (И-1). It is not a style rule: the horizon
    // makes sync unavailable for the length of any long query anywhere in the
    // database, which is far worse than the serialised tail it would replace.
    expect(code).not.toMatch(/pg_snapshot_xmin|pg_current_snapshot/)
    expect(code).toMatch(/pg_advisory_xact_lock/)
  })
})
