/**
 * Scenarios that are neither transport nor storage: the steps a feature takes,
 * expressed over the ports in `@vidya/domain` and the contracts in
 * `@vidya/protocol`, so the web and the device run the same ones.
 *
 * Empty on purpose. The package is created with the sync contract so both lanes
 * have somewhere agreed to put their scenarios — `sync/` is the device lane's,
 * and the admin console's live beside it. The barrel below is what every
 * consumer imports, so a scenario that is not re-exported here is not shipped.
 */

export {}
