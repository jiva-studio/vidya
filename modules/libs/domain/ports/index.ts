/**
 * Ports the application asks of the world — the sync engine's repositories and
 * a school's media storage. Interfaces only: the adapters that satisfy them
 * live with the infrastructure, and the domain never learns which one it got.
 */

export * from './mediaStorage'
export * from './outboxRepository'
export * from './syncApplyRepository'
export * from './syncStateRepository'
