// jsdom has no crypto.randomUUID before Node's webcrypto is bound to it, and the
// editor track leans on it for stable section ids.
import { webcrypto } from 'node:crypto'

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
}
