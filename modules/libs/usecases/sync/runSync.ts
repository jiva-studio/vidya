import type { SyncScopeRef } from '@vidya/domain'
import { syncScopeKey } from '@vidya/domain'

import {
  isSyncPausedError,
  isSyncTransportError,
  type MillisClock,
  type Random,
  type SyncEngineDeps,
  type SyncTransportError,
  type TokenRefresher,
} from './ports'
import { pullAndMerge, type PullAndMergeOptions, type PullAndMergeResult } from './pullAndMerge'
import { pushLocal, type PushLocalResult } from './pushLocal'
import { resyncScope } from './resyncScope'
import { createRetryPolicy, type RetryPolicy, type RetryPolicyOptions } from './retryPolicy'

/**
 * One sync run: push, then pull, under one lock.
 *
 * **The order is not an optimisation.** Lectorium pulls first and says so
 * openly, because there both sides write the same fields and a fresher base
 * costs it one conflict round at worst. Here the sides are split, and pulling
 * first would land the server's review status on a document whose answer is
 * still sitting unsent in the outbox. Give ours up first, take theirs second.
 *
 * The lock is a single in-flight promise, and a second caller gets that same
 * promise rather than a second run. Four triggers can fire at once — launch,
 * network return, a local write, pull-to-refresh — and network flapping fires
 * the second of them repeatedly. Two runs draining one
 * outbox would push the same rows twice.
 */

export const SyncOutcomes = [
  /** Both halves ran. */
  'completed',

  /** A run was already in flight; this call rode along with it. */
  'alreadyRunning',

  /** The token could not be renewed. Nothing was touched. */
  'deferred',

  /** The circuit is open on sustained unavailability. */
  'circuitOpen',

  /** The run stopped and will be retried after {@link SyncRunResult.retryAfterMs}. */
  'retryLater',

  /** The device suspended the database; the run resumes where it stopped. */
  'paused',
] as const

export type SyncOutcome = (typeof SyncOutcomes)[number]

export interface SyncRunResult {
  readonly outcome: SyncOutcome
  readonly push: PushLocalResult | null
  readonly pull: PullAndMergeResult | null

  /** Scopes refetched because their checksum disagreed. */
  readonly resynced: readonly SyncScopeRef[]

  /** Milliseconds to wait before the next attempt, when there is one. */
  readonly retryAfterMs: number | null

  /** The failure that stopped the run, when one did. */
  readonly failure: unknown
}

export interface SyncRunnerDeps extends SyncEngineDeps {
  /** Wall clock in unix milliseconds, for the retry policy. */
  readonly nowMs: MillisClock

  /** Jitter source. Two devices must not draw the same delay. */
  readonly random: Random

  /**
   * Renews the access token on a `401`. Absent means "cannot renew", which
   * defers the run rather than ending the session — a student must not lose a
   * course already on the device because a token expired.
   */
  readonly refreshToken?: TokenRefresher

  readonly pullOptions?: PullAndMergeOptions
  readonly retry?: RetryPolicyOptions
}

export interface ISyncRunner {
  run(): Promise<SyncRunResult>

  /** `true` while a run is in flight. */
  isRunning(): boolean

  /** The retry policy, so the trigger layer can ask when to come back. */
  readonly policy: RetryPolicy
}

const idle = (outcome: SyncOutcome, retryAfterMs: number | null = null): SyncRunResult => ({
  outcome,
  push: null,
  pull: null,
  resynced: [],
  retryAfterMs,
  failure: null,
})

export function createSyncRunner(deps: SyncRunnerDeps): ISyncRunner {
  const policy = createRetryPolicy(deps.nowMs, deps.random, deps.retry)
  let inFlight: Promise<SyncRunResult> | null = null

  const run = (): Promise<SyncRunResult> => {
    // No `await` between the test and the assignment, so this is genuinely
    // atomic on the event loop: two synchronous callers cannot both pass.
    if (inFlight !== null) return inFlight.then(withOutcome('alreadyRunning'))
    if (policy.isOpen()) return Promise.resolve(idle('circuitOpen', policy.opensInMs()))

    inFlight = cycle(deps, policy).finally(() => {
      inFlight = null
    })

    return inFlight
  }

  return { run, isRunning: () => inFlight !== null, policy }
}

/**
 * A second caller is told it did not start anything, but still receives what
 * the run in flight produced — so a pull-to-refresh that lands during a launch
 * sync shows that sync's result instead of spinning for nothing.
 */
const withOutcome =
  (outcome: SyncOutcome) =>
  (result: SyncRunResult): SyncRunResult => ({ ...result, outcome })

async function cycle(deps: SyncRunnerDeps, policy: RetryPolicy): Promise<SyncRunResult> {
  try {
    const result = await attempt(deps)
    policy.recordSuccess()
    return result
  } catch (error) {
    return handle(deps, policy, error)
  }
}

/**
 * The safety net for a suspend the halves did not catch themselves.
 *
 * A suspended database is not a failure and must not count towards the circuit
 * breaker: the app is going into the background, not the server going away.
 */
const pausedRun = (): SyncRunResult => idle('paused')

/** Push, pull, and refetch any scope whose checksum disagreed. */
async function attempt(deps: SyncRunnerDeps): Promise<SyncRunResult> {
  const push = await pushLocal(deps)
  const pull = await pullAndMerge(deps, deps.pullOptions)
  const resynced = await repairDiverged(deps, pull.diverged)

  return {
    outcome: push.paused || pull.paused ? 'paused' : 'completed',
    push,
    pull,
    resynced,
    retryAfterMs: null,
    failure: null,
  }
}

/**
 * Refetch each diverged scope once.
 *
 * Once, deliberately: a scope whose checksum still disagrees after a full
 * refetch is a server-side disagreement, and looping on it would turn a
 * reporting bug into a device that never stops downloading.
 */
async function repairDiverged(
  deps: SyncRunnerDeps,
  diverged: readonly SyncScopeRef[],
): Promise<SyncScopeRef[]> {
  const seen = new Set<string>()
  const repaired: SyncScopeRef[] = []

  for (const scope of diverged) {
    const key = syncScopeKey(scope)
    if (seen.has(key)) continue
    seen.add(key)

    await resyncScope(deps, scope, deps.pullOptions)
    repaired.push(scope)
  }

  return repaired
}

/**
 * Turn a failure into a decision.
 *
 * Every branch leaves the local state exactly as the last committed page left
 * it. Nothing here touches the outbox: a run that could not reach the server
 * has learnt nothing about the student's work.
 */
async function handle(
  deps: SyncRunnerDeps,
  policy: RetryPolicy,
  error: unknown,
): Promise<SyncRunResult> {
  if (isSyncPausedError(error)) return pausedRun()

  if (!isSyncTransportError(error)) {
    return { ...idle('retryLater', policy.recordFailure()), failure: error }
  }

  if (error.failure === 'unauthorized') return handleUnauthorized(deps, policy, error)

  // A refused request is our own doing — too many scopes, a bad cursor — and
  // waiting changes nothing about it. It is reported, not retried on a timer.
  if (error.failure === 'refused') {
    return { ...idle('retryLater', null), failure: error }
  }

  return {
    ...idle('retryLater', policy.recordFailure(error.retryAfterMs)),
    failure: error,
  }
}

/**
 * A `401` in the middle of a run.
 *
 * Try to renew the token and run once more — once, never twice: a second
 * refusal after a successful refresh is not a stale token, and repeating would
 * be a loop against an endpoint that has already said no twice.
 *
 * Failing to renew, the run is deferred
 * and **the session is left alone**: the app's `endSessionOn401` would end it,
 * and the student would lose access to a course that is already on their phone.
 * Offline reading is unconditional; a token governs the network, not the disk.
 */
async function handleUnauthorized(
  deps: SyncRunnerDeps,
  policy: RetryPolicy,
  error: SyncTransportError,
): Promise<SyncRunResult> {
  const renewed = deps.refreshToken === undefined ? false : await deps.refreshToken()
  if (!renewed) return { ...idle('deferred'), failure: error }

  try {
    const result = await attempt(deps)
    policy.recordSuccess()
    return result
  } catch (again) {
    return { ...idle('deferred'), failure: again }
  }
}
