/**
 * Ports the sync engine asks of the world. Interfaces only — the adapters that
 * satisfy them live with the device's infrastructure, and the domain never
 * learns which one it got.
 */

export * from './outboxRepository'
export * from './syncApplyRepository'
export * from './syncStateRepository'
