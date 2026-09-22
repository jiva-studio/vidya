import { projectionFor, SyncJournalSubscriber } from '@vidya/journal'
import { EntityManager, EntityTarget } from 'typeorm'

/** All the journal needs of a row it is asked to replay. */
interface SeededRow {
  id: string
}

/** A row the seeder has just made sure exists, and the entity it is. */
type SeededDocument = readonly [EntityTarget<SeededRow>, SeededRow]

const HELD = 'SELECT 1 FROM sync_journal WHERE collection = $1 AND doc_id = $2 LIMIT 1'

/**
 * Journals the documents the journal does not already hold.
 *
 * The seeder adds what is missing and leaves the rest alone, so a stand seeded
 * before the journal was wired keeps rows that no save will ever fire for
 * again — present in their tables, absent from every device. Only what is
 * missing is written: a document journalled once is not delivered afresh on
 * every run.
 */
export const journalWhatIsMissing = async (
  manager: EntityManager,
  documents: readonly SeededDocument[],
): Promise<void> => {
  const writer = manager.connection.subscribers.find(
    (subscriber): subscriber is SyncJournalSubscriber =>
      subscriber instanceof SyncJournalSubscriber,
  )

  if (!writer) return

  for (const [target, entity] of documents) {
    const entityName = manager.connection.getMetadata(target).name
    const projection = projectionFor(entityName)

    if (!projection) continue

    const held = await manager.query(HELD, [projection.collection, entity.id])

    if (held.length > 0) continue

    await writer.journalEntity({
      manager,
      entityName,
      entity: entity as unknown as Record<string, unknown>,
      docId: entity.id,
      op: 'upsert',
    })
  }
}
