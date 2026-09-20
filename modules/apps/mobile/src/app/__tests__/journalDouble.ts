import type { IOutboxRepository, OutboxEntry } from '@vidya/domain'

/**
 * A journal that answers the two readings a screen makes, and nothing else.
 *
 * Typed as the port rather than cast to it, on purpose. The hand-written
 * partial double it replaces listed the one method the view happened to call
 * and reached the port through `as unknown as IOutboxRepository` — so the day
 * the view began reading a second list, three tests died at run time with
 * `listDead is not a function`, in a band that had not touched them. Declared
 * whole, the same event is a compile error naming the missing method, which is
 * a note to the author rather than a puzzle for whoever runs the suite next.
 */
export function journalOf(
  unsettled: readonly OutboxEntry[],
  dead: readonly OutboxEntry[] = [],
): IOutboxRepository {
  return {
    listPending: () => Promise.resolve(unsettled),
    listUnsettled: () => Promise.resolve(unsettled),
    listDead: () => Promise.resolve(dead),
    append: () => Promise.resolve(),
    acknowledge: () => Promise.resolve(),
    renameDoc: () => Promise.resolve(),
    latestHlc: () => Promise.resolve(null),
    latestHlcOnDevice: () => Promise.resolve(null),
    latestId: () => Promise.resolve(0),
  }
}
