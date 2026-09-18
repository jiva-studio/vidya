import type { IDatabase, QueryParams } from '@/ports'

/**
 * Framework-free scaffolding for SQL-backed repositories on top of
 * {@link IDatabase}.
 *
 * Logic copied from `kit/src/persistence/repository.ts` in lectorium. It
 * replaces the query -> check -> map -> save boilerplate every repository
 * grows; the SQL strings and the row mappers stay with the repository that
 * owns the table.
 *
 * Error handling is deliberately a passthrough: whatever the driver throws
 * reaches the caller unchanged, so a failed write never looks like an empty
 * result.
 */

/**
 * Maps one raw SQL row to a domain value.
 *
 * Only the signature lives here — the bodies belong to the repositories,
 * which are the only place that knows both the column names and the domain
 * types.
 */
export type RowMapper<TRow, TValue> = (row: TRow) => TValue

/**
 * Runs a read query and maps the first row, or returns `null` when there are
 * none.
 */
export async function queryOne<TRow, TValue>(
  db: IDatabase,
  sql: string,
  params: QueryParams,
  map: RowMapper<TRow, TValue>,
): Promise<TValue | null> {
  const rows = await db.query<TRow>(sql, params)
  return rows.length > 0 ? map(rows[0]!) : null
}

/** Runs a read query and maps every row. */
export async function queryMany<TRow, TValue>(
  db: IDatabase,
  sql: string,
  params: QueryParams,
  map: RowMapper<TRow, TValue>,
): Promise<TValue[]> {
  const rows = await db.query<TRow>(sql, params)
  return rows.map(map)
}

/**
 * Executes one write statement and flushes it to storage.
 *
 * Use `db.execute` directly when several writes should share one flush — in
 * particular inside a transaction, where the block does the flushing once
 * after COMMIT.
 */
export async function mutate(db: IDatabase, sql: string, params?: QueryParams): Promise<void> {
  await db.execute(sql, params)
  await db.save()
}

/**
 * Runs `fn` inside one transaction and returns its result.
 *
 * This is the unit of work the sync engine writes through: a page of incoming
 * rows and the scope position that page advances go in the same call, so a
 * crash between them cannot leave the position ahead of the data it claims to
 * have (D-18). The block commits on resolve and rolls back on throw.
 */
export async function runInTransaction<TValue>(
  db: IDatabase,
  fn: () => Promise<TValue>,
): Promise<TValue> {
  let captured: TValue
  await db.transaction(async () => {
    captured = await fn()
  })

  // `db.transaction` resolves only after COMMIT, so `captured` is assigned.
  return captured!
}

/**
 * Optional thin base that binds one {@link IDatabase} so a repository can call
 * `this.queryOne(...)` without threading the database through every call.
 *
 * It is a convenience over the functions above and nothing more: no behaviour
 * of its own, no knowledge of any table.
 */
export class SqlRepository {
  protected readonly db: IDatabase

  constructor(db: IDatabase) {
    this.db = db
  }

  /** See {@link queryOne}. */
  protected queryOne<TRow, TValue>(
    sql: string,
    params: QueryParams,
    map: RowMapper<TRow, TValue>,
  ): Promise<TValue | null> {
    return queryOne(this.db, sql, params, map)
  }

  /** See {@link queryMany}. */
  protected queryMany<TRow, TValue>(
    sql: string,
    params: QueryParams,
    map: RowMapper<TRow, TValue>,
  ): Promise<TValue[]> {
    return queryMany(this.db, sql, params, map)
  }

  /** See {@link mutate}. */
  protected mutate(sql: string, params?: QueryParams): Promise<void> {
    return mutate(this.db, sql, params)
  }

  /** See {@link runInTransaction}. */
  protected runInTransaction<TValue>(fn: () => Promise<TValue>): Promise<TValue> {
    return runInTransaction(this.db, fn)
  }
}
