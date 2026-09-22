/**
 * The portable half of a Vidya client: the ports a client is written against,
 * the scenarios it runs, and the adapters that need no platform of their own —
 * SQL repositories, the device schema and its migrations, HTTP and the sync
 * transport.
 *
 * What a platform has to provide — the Capacitor database on a handset, a
 * browser's storage in a tab — is wired in the application that uses this, not
 * here.
 */

export * from './infra'
export * from './ports'
export * as auth from './usecases/auth'
export * as education from './usecases/education'
export * from './usecases/media'
export * from './usecases/sync'
