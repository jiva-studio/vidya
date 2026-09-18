import { Injectable } from '@nestjs/common'
import { SyncOp } from '@vidya/entities'
import {
  DataSource,
  EntityManager,
  EntitySubscriberInterface,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm'

import { currentSyncWriteContext } from './context'
import { CollectionProjection, projectionFor } from './projections'
import { ServerHlcService } from './serverHlc'
import { appendJournalRow } from './writer'

/** Everything a hook hands over, flattened so insert, update and remove agree. */
interface JournalEvent {
  manager: EntityManager
  entityName: string
  entity: Record<string, unknown> | undefined
  docId: string | undefined
  op: SyncOp
}

/**
 * The only writer of `sync_journal` (Д-2).
 *
 * Journalling from the domain services instead would mean two places that must
 * both remember, and on a push it would mean two rows for one change — the
 * push's own, and the subscriber's on the row the push just saved. So the rule
 * is absolute: nothing else inserts into `sync_journal`, and `edu/services`
 * stays untouched.
 *
 * It writes through `event.manager`, the manager of the transaction that is
 * already open, so the domain row and its journal row commit or roll back
 * together (T-S-2). It never opens a transaction of its own.
 *
 * Note that this listens to entity operations, not to SQL: a write made with
 * the query builder or `repository.update()` bypasses subscribers and would go
 * unjournalled. Synchronised entities are saved through `save()`/`remove()`,
 * which is what `EntitiesService` does.
 */
@Injectable()
export class SyncJournalSubscriber implements EntitySubscriberInterface {
  constructor(
    dataSource: DataSource,
    private readonly hlc: ServerHlcService,
  ) {
    dataSource.subscribers.push(this)
  }

  afterInsert(event: InsertEvent<Record<string, unknown>>): Promise<void> {
    return this.record({
      manager: event.manager,
      entityName: event.metadata.name,
      entity: event.entity,
      docId: event.entity?.id as string | undefined,
      op: 'upsert',
    })
  }

  afterUpdate(event: UpdateEvent<Record<string, unknown>>): Promise<void> {
    return this.record({
      manager: event.manager,
      entityName: event.metadata.name,
      entity: event.entity as Record<string, unknown> | undefined,
      docId: event.entity?.id as string | undefined,
      op: 'upsert',
    })
  }

  afterRemove(event: RemoveEvent<Record<string, unknown>>): Promise<void> {
    // `remove()` clears the primary key on the instance it was handed, so the
    // row is described by `databaseEntity` — what was actually in the table —
    // rather than by the emptied object the caller still holds. Without this the
    // scope resolves from an undefined id and the delete fails on NOT NULL.
    const removed = (event.databaseEntity ?? event.entity) as Record<string, unknown> | undefined

    return this.record({
      manager: event.manager,
      entityName: event.metadata.name,
      entity: removed,
      docId: removed?.id as string | undefined,
      op: 'delete',
    })
  }

  private async record(event: JournalEvent): Promise<void> {
    const projection = projectionFor(event.entityName)

    if (!projection || !event.entity || !event.docId) return
    if (projection.journals && !projection.journals(event.entity)) return

    await this.append(projection, event, event.entity, event.docId)
  }

  /**
   * Stamps the row and hands it to the writer.
   *
   * A push leaves `{ hlc, deviceId, authorId }` in the transactional context and
   * the row carries the device's own clock. A REST write from the admin console
   * has no context, so the server stamps its own HLC and the row carries
   * `deviceId = null` — which is also how a pull tells "not from any device"
   * apart from "from yours" when it filters the echo (T-S-8).
   */
  private async append(
    projection: CollectionProjection<Record<string, unknown>>,
    event: JournalEvent,
    entity: Record<string, unknown>,
    docId: string,
  ): Promise<void> {
    const target = await projection.target(entity, event.manager)
    const context = currentSyncWriteContext()

    await appendJournalRow(event.manager, {
      collection: projection.collection,
      docId,
      op: event.op,
      data: event.op === 'delete' ? null : projection.project(entity),
      hlc: context?.hlc ?? (await this.hlc.next(event.manager)),
      scopeKind: projection.scopeKind,
      scopeId: target.scopeId,
      schoolId: target.schoolId,
      deviceId: context?.deviceId ?? null,
      authorId: context?.authorId ?? null,
    })
  }
}
