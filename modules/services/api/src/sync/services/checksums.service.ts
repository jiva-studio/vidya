import { Injectable } from '@nestjs/common'
import * as domain from '@vidya/domain'
import { SyncChecksums } from '@vidya/protocol'
import { DataSource } from 'typeorm'

/** The latest stamp of one document, and which scope it belongs to. */
interface DocumentStamp {
  scope_kind: string
  scope_id: string
  collection: string
  doc_id: string
  hlc: string
}

const FNV_OFFSET = 0xcbf29ce484222325n
const FNV_PRIME = 0x100000001b3n
const MASK = 0xffffffffffffffffn

/** 64-bit FNV-1a. A hash, not a cipher: this detects divergence, it does not hide it. */
const fold = (value: string): bigint => {
  let hash = FNV_OFFSET

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash ^ BigInt(value.charCodeAt(index))) * FNV_PRIME) & MASK
  }

  return hash
}

const render = (hash: bigint): string => hash.toString(16).padStart(16, '0')

/**
 * A checksum per scope, so a device can find out *which* scope diverged (I-5).
 *
 * A sync engine cannot be debugged on a user's phone: the only way a drift is
 * ever noticed is if the two sides can compare a number. The number is folded
 * over the current stamp of every document in the scope — not over the journal
 * rows — because that is what the device can reproduce from what it stored. It
 * therefore changes exactly when the content of the scope changes, and stays
 * put when the same content arrives twice.
 *
 * The fold is exclusive-or, so it does not depend on the order documents come
 * back in, which no index guarantees and which two sides would otherwise have
 * to agree on as well.
 */
@Injectable()
export class SyncChecksumsService {
  constructor(private readonly dataSource: DataSource) {}

  async checksumsFor(scopes: readonly domain.SyncScopeRef[]): Promise<SyncChecksums> {
    if (scopes.length === 0) return {}

    const stamps = await this.stamps(scopes)
    const folded = new Map<string, bigint>()

    for (const stamp of stamps) {
      const key = `${stamp.scope_kind}:${stamp.scope_id}`
      const doc = fold(`${stamp.collection}:${stamp.doc_id}:${stamp.hlc}`)

      folded.set(key, (folded.get(key) ?? 0n) ^ doc)
    }

    return Object.fromEntries(
      scopes.map((scope) => {
        const key = domain.syncScopeKey(scope)
        return [key, render(folded.get(key) ?? 0n)]
      }),
    )
  }

  /**
   * The newest stamp of each document of each scope.
   *
   * `max(hlc)` is the newest because the stamps are zero-padded: text order is
   * causal order, which is the whole reason for the padding.
   */
  private async stamps(scopes: readonly domain.SyncScopeRef[]): Promise<DocumentStamp[]> {
    const conditions = scopes
      .map((_, index) => `(scope_kind = $${index * 2 + 1} AND scope_id = $${index * 2 + 2})`)
      .join(' OR ')

    return this.dataSource.query(
      `SELECT scope_kind, scope_id, collection, doc_id, max(hlc) AS hlc
         FROM sync_journal
        WHERE ${conditions}
        GROUP BY scope_kind, scope_id, collection, doc_id`,
      scopes.flatMap((scope) => [scope.kind, scope.id]),
    )
  }
}
