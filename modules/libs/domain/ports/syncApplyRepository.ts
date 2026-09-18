/**
 * Writing what the pull brought in, without journaling it back.
 *
 * Shape taken from Lectorium's `libs/domain/ports/syncApplyRepository.ts`, with
 * the anonymous-identity handover (`forgetDocHlcs`) and the data-wipe path
 * removed, and with `applyRemote` made conditional.
 *
 * It exists apart from the domain repositories because those are wrapped by the
 * journal decorator: writing a pulled change through them would put it straight
 * back into the outbox and echo it to the server. This port writes the rows
 * unjournaled and keeps the per-document server-HLC pointers beside them.
 *
 * Domain port; the SQL implementation is the device's. Every method joins the
 * caller's unit of work — the rows of a page and the scope position that
 * describes them are written together (Д-18).
 */

import { SyncCollection, SyncDoc, SyncPayload } from '../sync/types'

export interface ISyncApplyRepository {
  /**
   * The local version of a document for merging, or `null` when neither the row
   * nor a pointer for it exists. `hlc` is the document's known local HLC — the
   * greater of any pending outbox row's stamp and the last recorded server one.
   * `deleted` is `true` when the row is gone locally but a server HLC is still
   * on record: a tombstone this device has already seen.
   */
  getLocalDoc(collection: SyncCollection, docId: string): Promise<SyncDoc | null>

  /**
   * Persist a merged document without journaling it, and record `serverHlc` as
   * the document's new server pointer.
   *
   * **Conditional (Д-4.)** The write happens only when `serverHlc` is strictly
   * greater than the pointer already on record; otherwise the call is a no-op
   * and returns `false`. Without that test a page redelivered after a dropped
   * connection, or two scopes moving at their own pace, would put an older
   * version on top of a newer one and roll the document back in silence.
   *
   * `serverHlc` is passed apart from `doc.hlc` because a merge can keep this
   * device's unsent fields, whose stamp is the local one, while the pointer to
   * remember is still the server's.
   *
   * @returns `true` when the document was written, `false` when it was skipped
   *          as stale. The caller advances the scope position either way: a
   *          skipped row is applied, not lost.
   */
  applyRemote(collection: SyncCollection, doc: SyncDoc, serverHlc: string): Promise<boolean>

  /** The last server HLC recorded for a document — the `baseHlc` a push sends. */
  lastServerHlc(collection: SyncCollection, docId: string): Promise<string | null>

  /**
   * The highest server HLC recorded for any document, or `null` before the
   * first pull. This is the observed half of the HLC seed: a stamp issued by a
   * device with a faster clock has to carry this one forward, or the next local
   * edit is stamped below the change it descends from.
   */
  latestServerHlc(): Promise<string | null>

  /** Record a server HLC for a document — the push path's `accepted` answer. */
  recordServerHlc(collection: SyncCollection, docId: string, hlc: string): Promise<void>

  /**
   * Whether the payload a pull is about to write differs from what is stored.
   * Cheap guard for the screens: an identical page must not repaint them.
   */
  hasSamePayload(
    collection: SyncCollection,
    docId: string,
    data: SyncPayload | null,
  ): Promise<boolean>
}
