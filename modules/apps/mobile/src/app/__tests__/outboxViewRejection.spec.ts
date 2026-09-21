import type { OutboxEntry } from '@vidya/domain'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useOutboxView } from '../outboxView'
import { journalOf } from './journalDouble'

/**
 * What a screen is told about work the server refused.
 *
 * Once a refusal is terminal it is gone from the unsettled list, and the view
 * reads nothing else — so the document falls through to "no row, therefore
 * accepted" and is painted green. That is worse than showing nothing: the
 * student is told their application went through when it did not, and nothing
 * on any screen ever says otherwise.
 *
 * The finished-and-never-taken rows are the second reading the view owes them.
 */

const ENROLLMENT_DOC = '3a5c7e92-4b18-4d06-9f2e-1c8b6d4a3f57'

const entry = (overrides: Partial<OutboxEntry> = {}): OutboxEntry => ({
  id: 1,
  collection: 'enrollments',
  docId: ENROLLMENT_DOC,
  op: 'upsert',
  data: {},
  hlc: '1',
  baseHlc: null,
  ownerId: 'owner-a',
  status: 'rejected',
  reason: 'notYourEnrollment',
  createdAt: '2026-09-18T00:00:00.000Z' as OutboxEntry['createdAt'],
  ...overrides,
})

const settle = async (): Promise<void> => {
  for (let turn = 0; turn < 5; turn += 1) {
    await nextTick()
    await Promise.resolve()
  }
}

describe('refused work as a screen asks about it', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('does not call refused work accepted', async () => {
    const view = useOutboxView()
    view.track('owner-a', journalOf([], [entry()]))
    await settle()

    expect(view.state('enrollments', ENROLLMENT_DOC)).not.toBe('accepted')
  })

  it('names the refusal and its reason', async () => {
    const view = useOutboxView()
    view.track('owner-a', journalOf([], [entry()]))
    await settle()

    expect(view.state('enrollments', ENROLLMENT_DOC)).toBe('rejected')
    expect(view.reason('enrollments', ENROLLMENT_DOC)).toBe('notYourEnrollment')
  })

  it('lets work written after a refusal answer for the document', async () => {
    // The student cancelled again after the first attempt was refused. The
    // refused row stays in the journal for ever, and the screen that reads it
    // instead of the retry tells them their new request was refused too.
    const view = useOutboxView()
    const retry = entry({ id: 2, status: 'pending', reason: null })
    view.track('owner-a', journalOf([retry], [entry()]))
    await settle()

    expect(view.state('enrollments', ENROLLMENT_DOC)).toBe('notSent')
    expect(view.reason('enrollments', ENROLLMENT_DOC)).toBeUndefined()
  })

  it('keeps the refusal while it is the last thing written', async () => {
    const view = useOutboxView()
    const older = entry({ id: 1, status: 'pending', reason: null })
    view.track('owner-a', journalOf([older], [entry({ id: 2 })]))
    await settle()

    expect(view.state('enrollments', ENROLLMENT_DOC)).toBe('rejected')
    expect(view.reason('enrollments', ENROLLMENT_DOC)).toBe('notYourEnrollment')
  })

  it('still calls a document with nothing behind it accepted', async () => {
    const view = useOutboxView()
    view.track('owner-a', journalOf([], []))
    await settle()

    expect(view.state('enrollments', ENROLLMENT_DOC)).toBe('accepted')
    expect(view.reason('enrollments', ENROLLMENT_DOC)).toBeUndefined()
  })
})
