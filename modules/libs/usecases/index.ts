/**
 * Scenarios that are neither transport nor storage: the steps a feature takes,
 * expressed over the ports in `@vidya/domain` and the contracts in
 * `@vidya/protocol`, so the web and the device run the same ones.
 *
 * `sync/` is the device's — the engine that keeps a phone usable with no
 * network. Scenarios that are not re-exported here are not shipped.
 */

export * from './sync'
