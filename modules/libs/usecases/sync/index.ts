/**
 * The device's sync engine, as scenarios over ports.
 *
 * Four of them, and the order they run in is the contract: `pushLocal` first so
 * the student's own work leaves before anything can land on top of it, then
 * `pullAndMerge`, then `resyncScope` for whatever came back disagreeing.
 * `runSync` is the three of them under one lock.
 *
 * Nothing here knows about SQLite, HTTP, Capacitor or Vue. What it knows is the
 * ports in `@vidya/domain`, the contract in `@vidya/protocol`, and the four
 * ambient resources declared in `./ports` — transport, unit of work, clock and
 * randomness — every one of which a test supplies by hand.
 */

export * from './applyPage'
export * from './ports'
export * from './pullAndMerge'
export * from './pushLocal'
export * from './resyncScope'
export * from './retryPolicy'
export * from './runSync'
export * from './scopeKeys'
export * from './validateChange'
