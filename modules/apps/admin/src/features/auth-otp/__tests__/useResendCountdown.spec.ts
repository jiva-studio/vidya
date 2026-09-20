import { describe, expect, it } from 'vitest'

import { manualClock } from '@/shared/lib'

import { CODE_LIFETIME_SECONDS, useResendCountdown } from '../model'

describe('useResendCountdown', () => {
  it('counts down one second at a time', () => {
    const clock = manualClock()
    const countdown = useResendCountdown(clock)

    countdown.start(5)
    expect(countdown.remaining.value).toBe(5)

    clock.advance(3000)
    expect(countdown.remaining.value).toBe(2)
  })

  it('refuses another code until the wait is over', () => {
    const clock = manualClock()
    const countdown = useResendCountdown(clock)

    countdown.start(2)
    expect(countdown.canResend.value).toBe(false)

    clock.advance(2000)
    expect(countdown.canResend.value).toBe(true)
  })

  it('stops itself at zero rather than counting past it', () => {
    const clock = manualClock()
    const countdown = useResendCountdown(clock)

    countdown.start(2)
    clock.advance(10_000)

    expect(countdown.remaining.value).toBe(0)
    expect(clock.pending).toBe(0)
  })

  it('starts again from the top, without the old count still running', () => {
    const clock = manualClock()
    const countdown = useResendCountdown(clock)

    countdown.start(10)
    clock.advance(2000)
    countdown.start(4)
    clock.advance(1000)

    expect(countdown.remaining.value).toBe(3)
    expect(clock.pending).toBe(1)
  })

  it('leaves nothing scheduled once it is stopped', () => {
    const clock = manualClock()
    const countdown = useResendCountdown(clock)

    countdown.start()
    countdown.stop()

    expect(clock.pending).toBe(0)
    expect(countdown.remaining.value).toBe(CODE_LIFETIME_SECONDS)
  })

  it('reads the wait as minutes and seconds', () => {
    const clock = manualClock()
    const countdown = useResendCountdown(clock)

    countdown.start(125)
    expect(countdown.label.value).toBe('2:05')

    clock.advance(5000)
    expect(countdown.label.value).toBe('2:00')
  })
})
