import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SiteStatus } from '../types'

const freshStatus = async (): Promise<SiteStatus> => {
  vi.resetModules()
  const { useSiteStatus } = await import('../useSiteStatus')

  return useSiteStatus()
}

describe('what the site knows about its own data', () => {
  let status: SiteStatus

  beforeEach(async () => {
    status = await freshStatus()
  })

  it('has received nothing before any run', () => {
    expect(status.received.value).toBe(false)
  })

  it('has still received nothing after a run that brought nothing', () => {
    status.runStarted()
    status.runFinished(0, true)

    expect(status.firstRunCompleted.value).toBe(true)
    expect(status.received.value).toBe(false)
  })

  it('has received something once a run has brought rows', () => {
    status.runStarted()
    status.runFinished(3, true)

    expect(status.received.value).toBe(true)
  })

  it('counts a database filled on another day as data already received', () => {
    status.markFilled()

    expect(status.firstRunCompleted.value).toBe(true)
    expect(status.received.value).toBe(true)
  })
})
