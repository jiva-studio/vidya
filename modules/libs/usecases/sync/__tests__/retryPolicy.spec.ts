import { createRetryPolicy, jitteredDelay } from '../retryPolicy'

/**
 * The retry policy:.
 *
 * Pure, so the clock and the randomness are handed in and the assertions can be
 * exact. That is the whole reason both are ports: a test cannot state "two
 * devices do not retry together" against `Math.random()`, and a test that
 * cannot state it is a test that will not catch it.
 */

const clockFrom = (start: number) => {
  let now = start
  return { now: () => now, advance: (ms: number) => (now += ms) }
}

describe('the retry policy', () => {
  it('the delay grows exponentially', () => {
    const policy = createRetryPolicy(
      () => 0,
      () => 0.5,
    )

    const delays = [
      policy.recordFailure(),
      policy.recordFailure(),
      policy.recordFailure(),
      policy.recordFailure(),
    ]

    for (let index = 1; index < delays.length; index += 1) {
      expect(delays[index]).toBeGreaterThan(delays[index - 1]!)
    }
    expect(delays[1]).toBeCloseTo(delays[0]! * 2, -1)
  })

  it('two devices drawing different numbers do not retry together', () => {
    const one = createRetryPolicy(
      () => 0,
      () => 0.01,
    )
    const two = createRetryPolicy(
      () => 0,
      () => 0.99,
    )

    expect(one.recordFailure()).not.toBe(two.recordFailure())
    expect(one.recordFailure()).not.toBe(two.recordFailure())
  })

  it('the jitter keeps a floor as well as a spread', () => {
    // Full jitter would allow nearly zero here, which loses the growth exactly
    // when the server is worst off. Equal jitter keeps half the window fixed.
    for (const roll of [0, 0.25, 0.5, 0.75, 1]) {
      const delay = jitteredDelay(3, roll, 1_000, 60_000)
      expect(delay).toBeGreaterThanOrEqual(4_000)
      expect(delay).toBeLessThanOrEqual(8_000)
    }
  })

  it('the window is capped', () => {
    expect(jitteredDelay(40, 1, 1_000, 60_000)).toBe(60_000)
  })

  it('a delay named by the server wins over the computed one', () => {
    const policy = createRetryPolicy(
      () => 0,
      () => 0.5,
    )
    expect(policy.recordFailure(30_000)).toBe(30_000)
  })

  it('sustained unavailability opens the circuit instead of hammering', () => {
    const clock = clockFrom(1_000_000)
    const policy = createRetryPolicy(clock.now, () => 0.5, {
      failuresToOpen: 3,
      openForMs: 120_000,
    })

    policy.recordFailure()
    policy.recordFailure()
    expect(policy.isOpen()).toBe(false)

    policy.recordFailure()
    expect(policy.isOpen()).toBe(true)
    expect(policy.opensInMs()).toBe(120_000)

    clock.advance(119_999)
    expect(policy.isOpen()).toBe(true)

    clock.advance(2)
    expect(policy.isOpen()).toBe(false)
  })

  it('one success closes the circuit and resets the growth', () => {
    const clock = clockFrom(0)
    const policy = createRetryPolicy(clock.now, () => 0.5, { failuresToOpen: 2 })

    policy.recordFailure()
    const second = policy.recordFailure()
    expect(policy.isOpen()).toBe(true)

    policy.recordSuccess()

    expect(policy.isOpen()).toBe(false)
    expect(policy.failures()).toBe(0)
    expect(policy.recordFailure()).toBeLessThan(second)
  })

  it('a roll outside [0,1) cannot make the delay nonsense', () => {
    expect(jitteredDelay(0, Number.NaN, 1_000, 60_000)).toBe(500)
    expect(jitteredDelay(0, 5, 1_000, 60_000)).toBe(1_000)
    expect(jitteredDelay(0, -3, 1_000, 60_000)).toBe(500)
  })
})
