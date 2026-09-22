import type { IOutboxRepository, OutboxEntry } from '@vidya/domain'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { nextTick } from 'vue'

import { useSiteStatus } from '@/shared/status'
import { useOutboxView } from '@/shared/sync'

const OWNER = 'student-1'

const row = (over: Partial<OutboxEntry> = {}): OutboxEntry =>
  ({
    id: 1,
    ownerId: OWNER,
    collection: 'homework',
    docId: 'homework-1',
    op: 'put',
    status: 'pending',
    reason: null,
    ...over,
  }) as OutboxEntry

const journalOf = (unsettled: OutboxEntry[], dead: OutboxEntry[] = []): IOutboxRepository =>
  ({
    listUnsettled: vi.fn(async () => unsettled),
    listDead: vi.fn(async () => dead),
  }) as unknown as IOutboxRepository

const runs = () => useSiteStatus()

beforeEach(() => {
  useOutboxView().forgetJournal()
  const status = runs()
  ;(status.done as Ref<number>).value = 0
})

describe('how far a record got', () => {
  it('reads a document nobody journaled as taken by the school', async () => {
    useOutboxView().adoptJournal(OWNER, journalOf([]))
    await nextTick()

    expect(useOutboxView().state('homework', 'homework-1')).toBe('accepted')
  })

  it('reads a journaled record as still here while no run is going on', async () => {
    useOutboxView().adoptJournal(OWNER, journalOf([row()]))
    await nextTick()
    await nextTick()

    expect(useOutboxView().state('homework', 'homework-1')).toBe('notSent')
  })

  it('names why a refused record will not be carried again', async () => {
    const refused = row({ id: 2, status: 'rejected', reason: 'alreadyAccepted' })
    useOutboxView().adoptJournal(OWNER, journalOf([], [refused]))
    await nextTick()
    await nextTick()

    expect(useOutboxView().state('homework', 'homework-1')).toBe('rejected')
    expect(useOutboxView().reason('homework', 'homework-1')).toBe('alreadyAccepted')
  })

  it('lets the retry written after a refusal speak for the document', async () => {
    const refused = row({ id: 2, status: 'rejected', reason: 'alreadyAccepted' })
    const retry = row({ id: 3, status: 'pending' })
    useOutboxView().adoptJournal(OWNER, journalOf([retry], [refused]))
    await nextTick()
    await nextTick()

    expect(useOutboxView().state('homework', 'homework-1')).toBe('notSent')
  })

  it('answers about one document and not another journaled beside it', async () => {
    const elsewhere = row({ id: 4, collection: 'enrollments', docId: 'enrollment-1' })
    useOutboxView().adoptJournal(OWNER, journalOf([elsewhere]))
    await nextTick()
    await nextTick()

    expect(useOutboxView().state('enrollments', 'enrollment-1')).toBe('notSent')
    expect(useOutboxView().state('homework', 'homework-1')).toBe('accepted')
  })

  it('forgets the journal when the tab stops writing, rather than answering from a stale one', async () => {
    useOutboxView().adoptJournal(OWNER, journalOf([row()]))
    await nextTick()
    await nextTick()

    useOutboxView().forgetJournal()
    await nextTick()

    expect(useOutboxView().state('homework', 'homework-1')).toBe('accepted')
  })
})
