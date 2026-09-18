import { describe, expect, it, vi } from 'vitest'

import { useProgressReporter } from '../useProgressReporter'

const at = (currentTime: number) => ({ currentTime, duration: 600 }) as HTMLMediaElement

describe('useProgressReporter', () => {
  it('reports the first tick', () => {
    const report = vi.fn()
    useProgressReporter(report).tick(at(0.25))

    expect(report).toHaveBeenCalledOnce()
  })

  it('stays quiet while play has barely moved', () => {
    const report = vi.fn()
    const { tick } = useProgressReporter(report)

    tick(at(0))
    for (const t of [0.25, 0.5, 1, 2, 3, 4, 4.9]) tick(at(t))

    expect(report).toHaveBeenCalledOnce()
  })

  it('reports again once enough play has passed', () => {
    const report = vi.fn()
    const { tick } = useProgressReporter(report)

    for (const t of [0, 2, 5, 7, 10]) tick(at(t))

    expect(report).toHaveBeenCalledTimes(3)
  })

  it('keeps a ten-minute watch down to a couple of dozen reports', () => {
    const report = vi.fn()
    const { tick } = useProgressReporter(report)

    // timeupdate fires about four times a second
    for (let quarter = 0; quarter <= 600 * 4; quarter++) tick(at(quarter / 4))

    expect(report.mock.calls.length).toBeLessThan(130)
  })

  it('reports a seek backwards, which moves as far as a seek forwards', () => {
    const report = vi.fn()
    const { tick } = useProgressReporter(report)

    tick(at(300))
    tick(at(10))

    expect(report).toHaveBeenCalledTimes(2)
  })

  it('always reports where playback settled, however small the step', () => {
    const report = vi.fn()
    const { tick, settled } = useProgressReporter(report)

    tick(at(10))
    settled(at(10.4))

    expect(report).toHaveBeenCalledTimes(2)
    expect(report.mock.calls[1][0].currentTime).toBe(10.4)
  })

  it('does nothing without an element', () => {
    const report = vi.fn()
    const { tick, settled } = useProgressReporter(report)

    tick(undefined)
    settled(undefined)

    expect(report).not.toHaveBeenCalled()
  })
})
