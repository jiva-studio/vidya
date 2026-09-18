import type {
  IOutboxRepository,
  IsoDateTime,
  ISyncApplyRepository,
  ISyncStateRepository,
} from '@vidya/domain'
import type {
  AckCursorRequest,
  PullRequest,
  PullResponse,
  PushRequest,
  PushResponse,
} from '@vidya/protocol'

/**
 * What the sync scenarios ask of the world.
 *
 * The three repository ports are the domain's and both sides of the wire see
 * them. The ones declared here are the scenario layer's own: a transport, a
 * unit of work, a clock and a source of randomness. They live in this package
 * rather than in `@vidya/domain` because the transport speaks `@vidya/protocol`,
 * and the domain must not depend on the wire — the wire already depends on it.
 *
 * Determinism is the reason the last two exist at all. `Date.now()` and
 * `Math.random()` are forbidden in `libs/` by the lint config, because a test
 * cannot control either, and the two places this engine needs them — the HLC
 * stamp and the retry jitter — are precisely the places where an uncontrolled
 * value turns a failing test into a flaky one.
 */

/* -------------------------------------------------------------------------- */
/*                                 Transport                                  */
/* -------------------------------------------------------------------------- */

export interface ISyncClient {
  pull(request: PullRequest): Promise<PullResponse>
  push(request: PushRequest): Promise<PushResponse>

  /** Answered with `204`; the client keeps no state of its own. */
  ackCursor(request: AckCursorRequest): Promise<void>
}

/**
 * Why a sync request failed, in the terms the run has to act on.
 *
 * Deliberately coarser than HTTP: the scenarios branch on four things and no
 * more — refresh the token, back off, stop, or treat it as a dropped
 * connection. A status code in the scenario layer would put transport
 * knowledge where the transport is not.
 */
export const SyncTransportFailures = [
  /** `401`. Try to refresh the token; do not end the session. */
  'unauthorized',

  /** `429`, or an explicit slow-down. Back off. */
  'rateLimited',

  /** `5xx`. Stop this run without touching any state. */
  'server',

  /** No answer at all: a dropped connection or a timeout. */
  'unreachable',

  /** `4xx` other than `401`: the request itself was refused. */
  'refused',
] as const

export type SyncTransportFailure = (typeof SyncTransportFailures)[number]

export class SyncTransportError extends Error {
  readonly failure: SyncTransportFailure

  /** From `Retry-After`, when the server named a delay. Milliseconds. */
  readonly retryAfterMs: number | null

  constructor(failure: SyncTransportFailure, message?: string, retryAfterMs: number | null = null) {
    super(message ?? `sync transport failed: ${failure}`)
    this.name = 'SyncTransportError'
    this.failure = failure
    this.retryAfterMs = retryAfterMs
  }
}

export const isSyncTransportError = (error: unknown): error is SyncTransportError =>
  error instanceof SyncTransportError

/**
 * Thrown by the unit of work when the database has been suspended.
 *
 * The device raises it on the way into the background, because iOS kills an app
 * that still holds a SQLite lock when it is suspended. It is not
 * a data failure: nothing was written and nothing was lost, and the run simply
 * stops where it is. Resuming costs nothing because the scope positions of
 * every committed page are already durable.
 *
 * The device adapter translates its own `DatabaseSuspendedError` into this one,
 * so the scenarios never learn which database they are running on.
 */
export class SyncPausedError extends Error {
  constructor(message = 'sync stopped: the device suspended the database') {
    super(message)
    this.name = 'SyncPausedError'
  }
}

export const isSyncPausedError = (error: unknown): error is SyncPausedError =>
  error instanceof SyncPausedError

/* -------------------------------------------------------------------------- */
/*                              Ambient resources                             */
/* -------------------------------------------------------------------------- */

/**
 * Runs one unit of work in one transaction.
 *
 * "One unit" is **one page** and never more. A transaction spanning a
 * network round trip holds the SQLite lock across an await of unbounded length,
 * and on iOS that is a crash the student sees and we never do.
 */
export type UnitOfWork = <T>(fn: () => Promise<T>) => Promise<T>

/** Wall clock in unix milliseconds — the physical half of an HLC stamp. */
export type MillisClock = () => number

/** The current instant as stored and sent: ISO 8601, UTC, always. */
export type UtcClock = () => IsoDateTime

/**
 * A number in `[0, 1)`. Injected because the retry jitter must be reproducible
 * in a test and different between two devices in the field.
 */
export type Random = () => number

/**
 * Tries to renew the access token.
 *
 * Answers `true` when the next request may be attempted. It must **not** end
 * the session on failure: the app's `endSessionOn401` would take the student's
 * access to a course already sitting on the device, which is the opposite of
 * what offline is for.
 */
export type TokenRefresher = () => Promise<boolean>

/* -------------------------------------------------------------------------- */
/*                             The engine's world                             */
/* -------------------------------------------------------------------------- */

/** Everything the sync scenarios need, gathered once. */
export interface SyncEngineDeps {
  readonly client: ISyncClient
  readonly outbox: IOutboxRepository
  readonly apply: ISyncApplyRepository
  readonly state: ISyncStateRepository

  /** One transaction per page, per push round. Never wider. */
  readonly unitOfWork: UnitOfWork

  /**
   * Whose run this is. Passed rather than read from a session, because a row
   * belongs to the identity that wrote it even if the device changes hands
   * before the row is sent.
   */
  readonly ownerId: string

  readonly now: UtcClock
}
