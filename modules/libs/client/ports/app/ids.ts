/**
 * Where a new identifier comes from.
 *
 * A port rather than a call to the platform, because the layers above are pure:
 * a test that cannot fix the sequence cannot state what a write produced, and
 * an id minted from an ambient source turns every such assertion into a match
 * against whatever was generated.
 *
 * The device mints its own ids so that a retry after a crash writes the same
 * document rather than a second one. They travel in an idempotency key, so the
 * source has to be one that does not repeat: a v4 UUID from the platform's
 * CSPRNG, never a counter or a seeded generator, outside a test.
 */
export type UuidSource = () => string
