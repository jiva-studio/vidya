import { describe, expect, it, vi } from 'vitest'

import { useProgressReporter } from '../useProgressReporter'

const at = (currentTime: number) => ({ currentTime, duration: 600 }) as HTMLMediaElement

describe('useProgressReporter', () => {
  it('reports the first tick', () => {
    const report = vi.fn()
    useProgressReporter(report).tick(at(0.25))

    expect(report).toHaveBeenCalledOnce()
  })

  it('stays quiet for the whole of an ordinary lesson video', () => {
    const report = vi.fn()
    const { tick } = useProgressReporter(report)

    tick(at(0))
    for (let second = 1; second < 300; second++) tick(at(second))

    expect(report).toHaveBeenCalledOnce()
  })

  it('reports again once five minutes of play have passed', () => {
    const report = vi.fn()
    const { tick } = useProgressReporter(report)

    for (const t of [0, 120, 300, 420, 600]) tick(at(t))

    expect(report).toHaveBeenCalledTimes(3)
  })

  it('sends three reports for a ten-minute watch, not two thousand', () => {
    const report = vi.fn()
    const { tick } = useProgressReporter(report)

    // timeupdate fires about four times a second
    for (let quarter = 0; quarter <= 600 * 4; quarter++) tick(at(quarter / 4))

    expect(report).toHaveBeenCalledTimes(3)
  })

  it('measures the jump in either direction, so a long seek back counts', () => {
    const report = vi.fn()
    const { tick } = useProgressReporter(report)

    tick(at(900))
    tick(at(10))

    expect(report).toHaveBeenCalledTimes(2)
  })

  it('leaves a short seek to be caught on pause rather than reporting it', () => {
    const report = vi.fn()
    const { tick } = useProgressReporter(report)

    tick(at(100))
    tick(at(130))

    expect(report).toHaveBeenCalledOnce()
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
