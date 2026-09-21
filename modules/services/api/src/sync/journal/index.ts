export { currentSyncWriteContext, type SyncWriteContext, withSyncWriteContext } from './context'
export {
  COLLECTION_PROJECTIONS,
  type CollectionProjection,
  type JournalTarget,
  projectionFor,
} from './projections'
export { isServerDeviceId, SERVER_DEVICE_ID, serverDeviceId, ServerHlcService } from './serverHlc'
export { SyncJournalSubscriber } from './subscriber'
export { SYNCED_ENTITIES, SYNCED_ENTITY_NAMES } from './syncedEntities'
export { appendJournalRow, JOURNAL_LOCK_KEY, type JournalRow } from './writer'
// Shared infrastructure, re-exported because the journal is where a reader of
// the sync module looks for the clock its stamps come from.
export { CLOCK, type Clock, systemClock } from '@vidya/api/shared/clock'
