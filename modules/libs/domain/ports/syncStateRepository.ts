/**
 * Where this device stands: one read position per scope, plus the two
 * watermarks the push path keeps.
 *
 * Shape taken from Lectorium's `libs/domain/ports/syncStateRepository.ts`, with
 * its single `pullCursor` replaced by a position per scope. A new course
 * is then just a scope standing at `0`, whose history arrives through an
 * ordinary pull — which is why there is no backfill port and no backfill
 * endpoint anywhere in this contract.
 *
 * State is kept per identity as well as per device: signing out erases nothing,
 * and signing back in works offline.
 */

import { IsoDateTime } from '../identity'
import { SyncScopeRef } from '../sync/types'

/** One scope as the device tracks it. */
export interface SyncScopeState {
  readonly scope: SyncScopeRef

  /** Highest `serverSeq` of this scope applied locally. `0` before the first pull. */
  readonly cursor: number

  /** Last checksum the server reported for the scope, or `null` when never reported. */
  readonly checksum: string | null

  /**
   * When the scope left the caller's rights — a course they were withdrawn
   * from. Set, and nothing else: what was downloaded stays readable.
   */
  readonly removedAt: IsoDateTime | null
}

export interface ISyncStateRepository {
  /** This device's stable id: the HLC tiebreak and the echo-suppression key. */
  getDeviceId(): Promise<string>

  /** Every scope known to this device and identity, removed ones included. */
  listScopes(): Promise<readonly SyncScopeState[]>

  /**
   * Move one scope's position, and record the checksum that came with it.
   * Positions are independent — advancing one must never move another.
   * Called inside the transaction that wrote the page.
   */
  setScopeCursor(scope: SyncScopeRef, cursor: number, checksum: string | null): Promise<void>

  /**
   * Start tracking a scope the server has just reported, at position `0`. This
   * is the whole of "a new course arrives": no separate path, no second notion
   * of freshness.
   */
  addScope(scope: SyncScopeRef): Promise<void>

  /** Mark a scope gone at `at`, keeping every row it brought. */
  markScopeRemoved(scope: SyncScopeRef, at: IsoDateTime): Promise<void>

  /**
   * Take the removal mark off a scope the server grants again — the student was
   * enrolled on the course a second time.
   *
   * Its own call rather than a second meaning for {@link addScope}: adding
   * starts a scope at `0`, and a re-enrolled course must keep the position it
   * reached, or every pull would fetch its whole history again. Without this,
   * nothing in the system ever clears the mark: the position is excluded from
   * the cursors a pull sends, so the server reads the scope from the beginning
   * every time, and the screens go on telling the student they were withdrawn.
   */
  restoreScope(scope: SyncScopeRef): Promise<void>

  /**
   * Put a scope back to `0` so its content is fetched again — the answer to a
   * checksum that does not match. One scope, never the whole database.
   */
  resetScope(scope: SyncScopeRef): Promise<void>

  /** Highest `serverSeq` acknowledged to the server, across all scopes. */
  getAckedSeq(): Promise<number>
  setAckedSeq(seq: number): Promise<void>

  /**
   * The push watermark: outbox rows at or below this id are answered for and
   * are never sent again, whether they were accepted or refused.
   */
  getPushedOutboxId(): Promise<number>
  setPushedOutboxId(id: number): Promise<void>
}
