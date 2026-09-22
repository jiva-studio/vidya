import { describe, expect, it, vi } from 'vitest'

import { useSyncRuns } from '../useSyncRuns'

/**
 * A screen that has just changed what the server will send has to be able to
 * ask for it, and a tab that does not own the engine has to be able to say so
 * rather than pretend it ran something.
 */
describe('asking for a sync run from a screen', () => {
  it('answers that there was nothing to ask while no engine is offered', () => {
    useSyncRuns().adoptRunner(undefined)

    expect(useSyncRuns().requestRun()).toBe(false)
  })

  it('runs the engine the writing tab offered', () => {
    const run = vi.fn()
    useSyncRuns().adoptRunner(run)

    expect(useSyncRuns().requestRun()).toBe(true)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('stops running an engine that has been withdrawn', () => {
    const run = vi.fn()
    useSyncRuns().adoptRunner(run)
    useSyncRuns().adoptRunner(undefined)

    expect(useSyncRuns().requestRun()).toBe(false)
    expect(run).not.toHaveBeenCalled()
  })
})
