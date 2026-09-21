import type { UuidSource } from '@vidya/client'

/**
 * The platform's own v4 UUIDs.
 *
 * The ids minted here are part of the idempotency key `(collection, docId,
 * hlc)` the server deduplicates on, so they must not repeat across two
 * installations or two runs: `crypto.randomUUID()` is a CSPRNG, and nothing
 * weaker will do.
 */
export const cryptoUuids: UuidSource = () => crypto.randomUUID()
