import type { OutboxEntry } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { collectLatestOutboxRows, outboxKeyOf, submissionStateOf } from '../submissions'

const row = (id: number, over: Partial<OutboxEntry> = {}): OutboxEntry =>
  ({
    id,
    ownerId: 'student-1',
    collection: 'homework',
    docId: 'homework-1',
    op: 'put',
    status: 'pending',
    reason: null,
    ...over,
  }) as OutboxEntry

const latestOf = (rows: OutboxEntry[]) =>
  collectLatestOutboxRows(rows).get(outboxKeyOf('homework', 'homework-1'))

describe('what the journal says about a document', () => {
  it('keeps the last thing that happened to it, whichever order the rows are read in', () => {
    const refused = row(2, { status: 'rejected', reason: 'alreadyAccepted' })
    const retry = row(3)

    expect(latestOf([refused, retry])?.id).toBe(3)
    expect(latestOf([retry, refused])?.id).toBe(3)
  })

  it('keeps the refusal while nothing has been written since', () => {
    const earlier = row(1)
    const refused = row(2, { status: 'rejected', reason: 'alreadyAccepted' })

    expect(latestOf([refused, earlier])?.status).toBe('rejected')
  })

  it('answers about each document separately', () => {
    const elsewhere = row(9, { collection: 'enrollments', docId: 'enrollment-1' })
    const snapshot = collectLatestOutboxRows([row(1), elsewhere])

    expect(snapshot.size).toBe(2)
    expect(snapshot.get(outboxKeyOf('enrollments', 'enrollment-1'))?.id).toBe(9)
  })

  it('says nothing about a journal with nothing in it', () => {
    expect(collectLatestOutboxRows([]).size).toBe(0)
  })
})

describe('how far a journaled row got', () => {
  it('is refused where the server refused it, run or no run', () => {
    expect(submissionStateOf('rejected')).toBe('rejected')
    expect(submissionStateOf('rejected', true)).toBe('rejected')
  })

  it('is taken once the push carried it', () => {
    expect(submissionStateOf('pushed')).toBe('accepted')
  })

  it('tells waiting here apart from leaving right now', () => {
    expect(submissionStateOf('pending')).toBe('notSent')
    expect(submissionStateOf('pending', true)).toBe('sending')
  })
})
