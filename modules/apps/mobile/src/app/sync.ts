import { App } from '@capacitor/app'
import { Network } from '@capacitor/network'
import type { Connection, HttpClient, IConnectionStore, IDatabase, Session } from '@vidya/client'
import { createHttpSyncClient } from '@vidya/client'
import { httpClientFor, normaliseBaseUrl } from '@vidya/client'
import { createSyncEngine, type SyncEngine } from '@vidya/client'
import type { UserId } from '@vidya/domain'
import { toIsoDateTime } from '@vidya/domain'
import type { RefreshTokensRequest, RefreshTokensResponse } from '@vidya/protocol'
import { Routes } from '@vidya/protocol'
import type { SyncRunResult } from '@vidya/usecases'

import { PreferencesDeviceId } from '@/infra/storage/preferencesDeviceId'

import { type DeviceRuns, deviceRunsFor } from './deviceRuns'
import { haltedWhenSuspended } from './haltedSyncClient'
import { useSyncStatus } from './syncStatus'

/**
 * Where the sync engine is wired into the running app, and when it runs.
 *
 * Three decisions live here and nowhere else.
 *
 * **An engine belongs to a connection.** Its transport is built from that
 * connection's address and closes over it, so the token held for one school
 * cannot reach another server even by mistake. There is no shared client to
 * reach for.
 *
 * **The engine gets a bare HTTP client.** A sync run meeting an expired token
 * through a client that ends sessions would sign the student out — taking away
 * a course already sitting on their phone. The run renews the token itself, and
 * a renewal that is refused marks that one connection as needing a new sign-in
 * while every other connection keeps running.
 *
 * **Going into the background releases the SQLite lock.** iOS kills an app that
 * is still holding one when it is suspended, and that death happens on a
 * student's handset and never in our logs.
 *
 * The four triggers are launch, the network coming back, a local write
 * (debounced) and pull-to-refresh. They can all fire at once, which is why the
 * runs of a database are queued and why the retry policy jitters.
 */

/** How long a local write waits for its neighbours before a run is asked for. */
export const WRITE_DEBOUNCE_MS = 2_000

export interface SyncTriggers {
  /** Runs now, behind whatever this database is already running. */
  now(): Promise<SyncRunResult>

  /** Asks for a run after {@link WRITE_DEBOUNCE_MS}, coalescing repeats. */
  soon(): void

  /** Stops listening, and releases the lock once no engine is left. */
  stop(): Promise<void>
}

export interface SyncSetupOptions {
  readonly db: IDatabase

  /** The server to sync with, and the identity holding the device's rows. */
  readonly connection: Connection

  /** Where a renewed session — or a refused renewal — is recorded. */
  readonly connections: IConnectionStore
}

/**
 * A running engine, and what the rest of the app reaches it through.
 *
 * `http` is handed out rather than rebuilt by the caller: it is bound to this
 * connection's address and reads the session per request, so a screen asking
 * the school for something cannot reach another server or send a token that
 * has since been renewed.
 */
export interface StartedSync {
  readonly engine: SyncEngine
  readonly triggers: SyncTriggers
  readonly http: HttpClient
}

/** What is running, and enough about it to tell a repeat start from a new one. */
interface RunningSync extends StartedSync {
  readonly runs: DeviceRuns
  readonly ownerId: UserId

  /** Takes the session a fresh sign-in produced, in place of the one it holds. */
  adopt(connection: Connection): void
}

/**
 * The transport bound to one server, and the only place in `app/` that builds
 * one.
 *
 * The address is closed over rather than passed per call, so a token held for
 * one school has nowhere else to travel. The session is read per request
 * because it is replaced whole whenever it is renewed, and a client built
 * around a captured token would go on sending the expired one.
 */
export const connectionClient = (baseUrl: string, session: () => Session | undefined): HttpClient =>
  httpClientFor({ baseUrl, session })

const running = new Map<string, RunningSync>()

/** A run that was not attempted, reported as the engine reports its own. */
const deferred = (): SyncRunResult => ({
  outcome: 'deferred',
  push: null,
  pull: null,
  resynced: [],
  retryAfterMs: null,
  failure: null,
})

/**
 * The engine already listening for this server, when there is one.
 *
 * Starting a second engine for a server that already has one is the defect
 * this answers: the first would stay subscribed to the lifecycle events with
 * nothing left holding a handle to it, it would keep its place in the count
 * that decides when the lock goes back, and — after a second person signed in
 * on the same server — it would go on pulling and pushing under the previous
 * `ownerId` into the same database.
 */
const alreadyRunning = (baseUrl: string, runs: DeviceRuns): RunningSync | undefined => {
  const started = running.get(baseUrl)
  return started?.runs === runs ? started : undefined
}

export async function startSync(options: SyncSetupOptions): Promise<StartedSync> {
  const baseUrl = normaliseBaseUrl(options.connection.baseUrl)
  const deviceId = new PreferencesDeviceId()
  const runs = deviceRunsFor(options.db)

  const existing = alreadyRunning(baseUrl, runs)
  if (existing !== undefined) {
    // The same identity on the same server: hand back the engine that is
    // already listening, holding the session it has just been given — signing
    // in again is how a stranded connection is repaired, and an engine that
    // kept the dead token would strand it a second time. A different identity
    // signed in since: the old engine has to go before the new one starts.
    if (existing.ownerId === options.connection.ownerId) {
      existing.adopt(options.connection)
      return existing
    }

    await stopSync(baseUrl)
  }

  // A session is replaced whole when it is renewed, so the client reads it per
  // request rather than capturing the token it was built with.
  let session: Session = options.connection.session

  // Read from the registry, not merely written to it: a connection whose
  // renewal was refused has nothing to say to its server until somebody signs
  // in again, and a run would be two requests spent to be told so twice.
  let awaitingSignIn = options.connection.needsSignIn

  const http = connectionClient(baseUrl, () => session)

  const renew = async (): Promise<boolean> => {
    const renewed = await renewSession(http, session)
    if (renewed === null) {
      awaitingSignIn = true
      await options.connections.update(baseUrl, { needsSignIn: true })
      return false
    }

    session = renewed
    await options.connections.update(baseUrl, { session: renewed, needsSignIn: false })

    return true
  }

  const engine = createSyncEngine({
    db: runs.db,
    client: haltedWhenSuspended(createHttpSyncClient({ http }), runs.isSuspended),
    deviceId: () => deviceId.current(),
    ownerId: () => options.connection.ownerId,
    now: () => toIsoDateTime(new Date()),
    nowMs: () => Date.now(),
    random: () => Math.random(),
    refreshToken: renew,
  })

  runs.attach()

  const started: RunningSync = {
    engine,
    http,
    triggers: await listen(engine, runs, () => awaitingSignIn),
    runs,
    ownerId: options.connection.ownerId,
    adopt: (connection) => {
      session = connection.session
      awaitingSignIn = connection.needsSignIn
    },
  }

  running.set(baseUrl, started)

  return started
}

/** Every engine running right now, in the order their connections were started. */
export const runningSyncs = (): readonly StartedSync[] => [...running.values()]

/**
 * Stops the engine of one connection.
 *
 * Signing out has to reach this: an engine left listening would go on renewing
 * tokens and holding the lock for an account that is no longer here. Nothing
 * stored is removed — the outbox keeps every unsent row.
 */
export async function stopSync(baseUrl: string): Promise<void> {
  const address = normaliseBaseUrl(baseUrl)
  const started = running.get(address)
  if (started === undefined) return

  running.delete(address)
  await started.triggers.stop()
}

/**
 * Trade the refresh token for a fresh session, answering `null` on any failure.
 *
 * It does not end anything. The student keeps reading what is on the device;
 * only the network half of this one connection waits for a new sign-in.
 */
async function renewSession(http: HttpClient, session: Session): Promise<Session | null> {
  try {
    const renewed = await http.post<RefreshTokensResponse>(Routes().auth.tokens.refresh(), {
      refreshToken: session.refreshToken,
    } satisfies RefreshTokensRequest)

    return { accessToken: renewed.accessToken, refreshToken: renewed.refreshToken }
  } catch {
    // Reported by answering `null`: the run defers and the connection is marked
    // as needing a sign-in. A rethrow would end the session, which is exactly
    // what must not happen.
    return null
  }
}

async function listen(
  engine: SyncEngine,
  runs: DeviceRuns,
  awaitingSignIn: () => boolean,
): Promise<SyncTriggers> {
  const status = useSyncStatus()
  let debounce: ReturnType<typeof setTimeout> | null = null

  const now = async (): Promise<SyncRunResult> => {
    // Nothing is touched, which is what `deferred` means: the device keeps
    // everything it has downloaded and stays readable, and the school waits
    // for a sign-in rather than for a token that will never be accepted.
    if (awaitingSignIn()) return deferred()

    status.runStarted()
    const result = await runs.run(() => engine.runner.run())
    status.runFinished(result)

    return result
  }

  const soon = () => {
    if (debounce !== null) clearTimeout(debounce)
    debounce = setTimeout(() => {
      debounce = null
      void now()
    }, WRITE_DEBOUNCE_MS)
  }

  const background = () => runs.suspend()

  const foreground = () => {
    runs.resume()
    void now()
  }

  // Both events, deliberately. `appStateChange` is the cross-platform one and
  // `pause`/`resume` are the native lifecycle pair; which of them a given
  // platform and version delivers is not something to bet a `0xdead10cc` on.
  // `suspend()` is documented as safe to call twice and on an idle database, so
  // the overlap costs nothing.
  const stateChange = await App.addListener('appStateChange', ({ isActive }) =>
    isActive ? foreground() : void background(),
  )
  const paused = await App.addListener('pause', () => void background())
  const resumed = await App.addListener('resume', () => foreground())

  const networkChange = await Network.addListener('networkStatusChange', (status) => {
    if (status.connected) void now()
  })

  const stop = async () => {
    if (debounce !== null) clearTimeout(debounce)
    await stateChange.remove()
    await paused.remove()
    await resumed.remove()
    await networkChange.remove()
    await runs.detach()
  }

  return { now, soon, stop }
}
