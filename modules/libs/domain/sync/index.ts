/**
 * Sync primitives shared by the server, the device and the use cases: the HLC
 * value object, the replicated vocabulary, the direction and ownership tables,
 * and the merge rule built on them. Zero dependencies — pure logic only.
 */

export * from './direction'
export * from './hlc'
export * from './merge'
export * from './types'
