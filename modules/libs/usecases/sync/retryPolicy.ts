import type { MillisClock, Random } from './ports'

/**
 * How long to wait before trying again, and when to stop trying at all.
 *
 * Four sync triggers — launch, network return, local write, pull-to-refresh —
 * fire on the same events on every device, so a plain doubling with no jitter
 * lines every device up on one retry schedule and the synchronised herd
 * finishes off a server that was only stumbling. Hence exponential growth,
 * jitter, a ceiling, and a circuit breaker on sustained unavailability.
 *
 * The jitter is *equal* jitter — half the window fixed, half random — rather
 * than full jitter. Full jitter can return a delay of nearly zero, which loses
 * the growth exactly when the server is worst off; equal jitter keeps a floor
 * that doubles with each attempt while still spreading two devices apart.
 *
 * Pure but for the two injected ports: `Math.random()` is forbidden in `libs/`,
 * and two devices differ because their random sources differ, which a test has
 * to be able to arrange.
 */

export interface RetryPolicyOptions {
  /** Delay window for the first failure. */
  readonly baseMs?: number

  /** Ceiling on the window, however many failures have piled up. */
  readonly maxMs?: number

  /** Consecutive failures that open the circuit. */
  readonly failuresToOpen?: number

  /** How long the circuit stays open before one attempt is allowed through. */
  readonly openForMs?: number
}

const DEFAULTS = {
  baseMs: 1_000,
  maxMs: 5 * 60_000,
  failuresToOpen: 5,
  openForMs: 10 * 60_000,
} as const

export interface RetryPolicy {
  /** Consecutive failures since the last success. */
  failures(): number

  /** `true` while the circuit is open and no request should be made. */
  isOpen(): boolean

  /** Milliseconds until the circuit closes, or `0` when it is not open. */
  opensInMs(): number

  /**
   * Record a failure and answer how long to wait.
   *
   * A `retryAfterMs` the server named wins over the computed window: when the
   * server has said when to come back, guessing is worse than obeying.
   */
  recordFailure(retryAfterMs?: number | null): number

  /** Record a success: the failure count and the circuit both reset. */
  recordSuccess(): void
}

export function createRetryPolicy(
  now: MillisClock,
  random: Random,
  options: RetryPolicyOptions = {},
): RetryPolicy {
  const settings = { ...DEFAULTS, ...options }
  let failures = 0
  let openUntil = 0

  return {
    failures: () => failures,

    isOpen: () => openUntil > now(),

    opensInMs: () => Math.max(0, openUntil - now()),

    recordFailure(retryAfterMs) {
      failures += 1
      if (failures >= settings.failuresToOpen) openUntil = now() + settings.openForMs

      const named = retryAfterMs ?? null
      return named !== null && named > 0
        ? named
        : jitteredDelay(failures - 1, random(), settings.baseMs, settings.maxMs)
    },

    recordSuccess() {
      failures = 0
      openUntil = 0
    },
  }
}

/**
 * The delay for `attempt`, counted from zero.
 *
 * `window = min(max, base * 2^attempt)`, then half of it fixed and half of it
 * scaled by `roll`. Exported because the growth and the spread are separately
 * worth asserting, and a test should not have to drive a whole policy to see
 * either.
 */
export function jitteredDelay(
  attempt: number,
  roll: number,
  baseMs: number = DEFAULTS.baseMs,
  maxMs: number = DEFAULTS.maxMs,
): number {
  const window = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt))
  const half = window / 2

  return Math.round(half + half * clampRoll(roll))
}

const clampRoll = (roll: number): number =>
  Number.isFinite(roll) ? Math.min(1, Math.max(0, roll)) : 0
