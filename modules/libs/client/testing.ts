/**
 * What a client's tests need and its build must not have: a migrated database
 * in one line, the conformance suite every `IDatabase` has to pass, and a sync
 * server that answers in memory.
 *
 * Kept out of the package's own entry point so that nothing shipped can reach
 * it by accident.
 */

export * from './infra/persistence/__tests__/databaseConformance'
export * from './infra/persistence/testing'
export * from './usecases/sync/__tests__/fakeSyncServer'
export * from './usecases/sync/__tests__/harness'
