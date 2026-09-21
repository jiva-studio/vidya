import type { IEnrollmentRepository, LocalEnrollment } from '@vidya/client'
import { asId, type EnrollmentId } from '@vidya/domain'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useOutboxView, useSyncRuns } from '@/shared/sync'

import { announceEnrollmentWrites } from '../enrollmentWrites'

const ID = asId<EnrollmentId>('enrollment-1')

const written = { id: ID } as LocalEnrollment

const aRepository = (failing = false) =>
  ({
    request: vi.fn(async () => {
      if (failing) throw new Error('refused')
      return written
    }),
    withdraw: vi.fn(async () => written),
    archive: vi.fn(async () => written),
    unarchive: vi.fn(async () => written),
  }) as unknown as IEnrollmentRepository

describe('a write the student has just made', () => {
  let runs = 0

  beforeEach(() => {
    runs = 0
    useSyncRuns().adoptRunner(() => {
      runs += 1
    })
    useOutboxView().forget()
  })

  it('answers with the row that was stored', async () => {
    const writes = announceEnrollmentWrites(aRepository())

    await expect(writes.request({ id: ID } as never)).resolves.toBe(written)
  })

  it('asks for a run, so the request leaves now rather than at the next reload', async () => {
    const writes = announceEnrollmentWrites(aRepository())

    await writes.withdraw(ID)

    expect(runs).toBe(1)
  })

  it('shows as waiting before any run has answered for it', async () => {
    const view = useOutboxView()
    const refresh = vi.spyOn(view, 'refresh')
    const writes = announceEnrollmentWrites(aRepository())

    await writes.archive(ID)

    expect(refresh).toHaveBeenCalled()
  })

  it('asks for nothing when the write was refused, because nothing was journaled', async () => {
    const writes = announceEnrollmentWrites(aRepository(true))

    await expect(writes.request({ id: ID } as never)).rejects.toThrow('refused')
    expect(runs).toBe(0)
  })

  it('carries every way a student has of answering for their own request', async () => {
    const repository = aRepository()
    const writes = announceEnrollmentWrites(repository)

    await writes.unarchive(ID)

    expect(repository.unarchive).toHaveBeenCalledWith(ID)
    expect(runs).toBe(1)
  })
})
