import type { IOutboxRepository, OutboxEntry, OutboxScope } from '@vidya/domain'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useOutboxView } from '../outboxView'
import { useSyncStatus } from '../syncStatus'

/**
 * What a screen is told about a row it has written.
 *
 * The snapshot is re-read when a run finishes, and that moment is the only
 * signal there is: the journal is written by the engine, in a transaction no
 * screen watches. Miss it and a student's answer stays "not sent" on the screen
 * for as long as they keep it open, whatever the server has already said.
 */

const HOMEWORK_DOC = 'e2f1c8d4-1b77-4f2a-9d31-6a0c5e4b7a92'

const entry = (overrides: Partial<OutboxEntry> = {}): OutboxEntry => ({
  id: 1,
  collection: 'homework',
  docId: HOMEWORK_DOC,
  op: 'upsert',
  data: {},
  hlc: '1',
  baseHlc: null,
  ownerId: 'owner-a',
  status: 'pending',
  reason: null,
  createdAt: '2026-09-18T00:00:00.000Z' as OutboxEntry['createdAt'],
  ...overrides,
})

const journalOf = (rows: OutboxEntry[]): IOutboxRepository =>
  ({
    listUnsettled: (_scope: OutboxScope) => Promise.resolve(rows),
  }) as unknown as IOutboxRepository

/** Lets the watcher fire and the journal read behind it settle. */
const settle = async (): Promise<void> => {
  for (let turn = 0; turn < 5; turn += 1) {
    await nextTick()
    await Promise.resolve()
  }
}

const completedRun = () => ({
  outcome: 'completed' as const,
  push: null,
  pull: null,
  resynced: [],
  retryAfterMs: null,
  failure: null,
})

describe('the outbox as a screen asks about it', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('answers "accepted" for a document with nothing left in the journal', async () => {
    const view = useOutboxView()
    view.track('owner-a', journalOf([]))
    await settle()

    expect(view.state('homework', HOMEWORK_DOC)).toBe('accepted')
    expect(view.reason('homework', HOMEWORK_DOC)).toBeUndefined()
  })

  it('carries the refusal and its reason', async () => {
    const view = useOutboxView()
    view.track('owner-a', journalOf([entry({ status: 'rejected', reason: 'notYourEnrollment' })]))
    await settle()

    expect(view.state('homework', HOMEWORK_DOC)).toBe('rejected')
    expect(view.reason('homework', HOMEWORK_DOC)).toBe('notYourEnrollment')
  })

  it('re-reads the journal when a run finishes', async () => {
    const rows = [entry()]
    const view = useOutboxView()
    const status = useSyncStatus()

    view.track('owner-a', journalOf(rows))
    await settle()
    expect(view.state('homework', HOMEWORK_DOC)).toBe('notSent')

    // The run takes the row; the screen must not keep showing it as unsent.
    status.runStarted()
    rows.length = 0
    status.runFinished(completedRun())
    await settle()

    expect(view.state('homework', HOMEWORK_DOC)).toBe('accepted')
  })

  it('shows a queued row as on its way while a run is going on', async () => {
    const view = useOutboxView()
    const status = useSyncStatus()

    view.track('owner-a', journalOf([entry()]))
    await settle()

    status.runStarted()
    expect(view.state('homework', HOMEWORK_DOC)).toBe('sending')

    status.runFinished(completedRun())
    await settle()
  })
})
