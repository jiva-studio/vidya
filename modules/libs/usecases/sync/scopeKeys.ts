import { SyncScopeKinds, type SyncScopeRef } from '@vidya/domain'

/**
 * Which scopes this build is willing to write down.
 *
 * The device stores a row per scope and hands every stored scope straight back
 * to the server as a cursor on the next pull. That makes `sync_scopes` the one
 * table where an unchecked value from the wire becomes a *permanent* request
 * the server has to answer — and a request the server cannot answer is a `400`,
 * which the run reports as `refused`. Pull then stops for good, while push
 * carries on as if all were well.
 *
 * So a scope is checked before it is stored, never after:
 *
 * - the **kind** must be one this build knows. A newer server may grant a kind
 *   we have never heard of; ignoring it costs the rows of that scope, and
 *   storing it costs every row of every scope, forever.
 * - the **id** must be a UUID, because the server resolves a cursor key by
 *   casting the id to `uuid`: a malformed one is a failed cast, which is a
 *   `500` rather than a `400` — the same dead pull with a worse alarm.
 *
 * Ignoring beats repairing: a scope we cannot name is a scope we cannot ask
 * about, and the rest of the pull is unaffected by leaving it alone.
 */

/** Any UUID, any version — the shape of every identifier here. */
const SCOPE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The scope as this build would store it, or `null` when it would not. */
export function asStorableScope(value: unknown): SyncScopeRef | null {
  if (value === null || typeof value !== 'object') return null

  const candidate = value as { kind?: unknown; id?: unknown }
  if (typeof candidate.kind !== 'string' || typeof candidate.id !== 'string') return null
  if (!(SyncScopeKinds as readonly string[]).includes(candidate.kind)) return null
  if (!SCOPE_ID.test(candidate.id)) return null

  return { kind: candidate.kind as SyncScopeRef['kind'], id: candidate.id }
}

/**
 * Read a `<kind>:<id>` key from the wire, or answer `null`.
 *
 * `@vidya/domain` has `parseSyncScopeKey`, which throws — right for a key this
 * side wrote, wrong for a key the server chose: a throw here would take down
 * the page, and with it every good scope in it.
 */
export function scopeFromKey(key: string): SyncScopeRef | null {
  const separator = key.indexOf(':')
  if (separator < 1) return null

  return asStorableScope({ kind: key.slice(0, separator), id: key.slice(separator + 1) })
}
