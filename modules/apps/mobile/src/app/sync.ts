import { App } from '@capacitor/app'
import { Network } from '@capacitor/network'
import { toIsoDateTime } from '@vidya/domain'
import type { RefreshTokensRequest, RefreshTokensResponse } from '@vidya/protocol'
import { Routes } from '@vidya/protocol'
import type { SyncRunResult } from '@vidya/usecases'

import { config } from '@/config'
import { FetchHttpClient } from '@/infra'
import { PreferencesDeviceId } from '@/infra/storage/preferencesDeviceId'
import { createHttpSyncClient } from '@/infra/sync/http/syncClient'
import type { HttpClient, IDatabase } from '@/ports'
import { createSyncEngine, type SyncEngine } from '@/usecases/sync'

import { useSession } from './session'

/**
 * Where the sync engine is wired into the running app, and when it runs.
 *
 * Two decisions live here and nowhere else.
 *
 * **The engine gets a bare HTTP client.** `useApi()` is wrapped in
 * `endSessionOn401`, and a sync run meeting an expired token through it would
 * sign the student out — taking away a course already sitting on their phone.
 * The run renews the token itself and defers if it cannot (D-10, AC-22f).
 *
 * **`pause` releases the SQLite lock.** iOS kills an app that is still holding
 * one when it is suspended, and that death happens on a student's handset and
 * never in our logs (D-14, AC-22i). The in-flight page is allowed to settle,
 * the lock is released, and the run resumes from the scope positions it already
 * committed — resumption costs nothing precisely because those positions are
 * durable.
 *
 * The four triggers are the plan's: launch, the network coming back, a local
 * write (debounced), and pull-to-refresh. They can all fire at once, which is
 * why the runner holds a lock and why the retry policy jitters (D-15).
 */

/** How long a local write waits for its neighbours before a run is asked for. */
export const WRITE_DEBOUNCE_MS = 2_000

export interface SyncTriggers {
  /** Runs now, unless a run is already in flight. */
  now(): Promise<SyncRunResult>

  /** Asks for a run after {@link WRITE_DEBOUNCE_MS}, coalescing repeats. */
  soon(): void

  /** Stops listening and releases the lock. */
  stop(): Promise<void>
}

export interface SyncSetupOptions {
  readonly db: IDatabase

  /** Injected in tests; the app supplies none and gets the real ones. */
  readonly ownerId: () => string
}

export interface StartedSync {
  readonly engine: SyncEngine
  readonly triggers: SyncTriggers
}

export async function startSync(options: SyncSetupOptions): Promise<StartedSync> {
  const session = useSession()
  const deviceId = new PreferencesDeviceId()

  // Bare on purpose — see the note above about `endSessionOn401`.
  const http = new FetchHttpClient({
    baseUrl: config.apiBaseUrl,
    accessToken: () => session.session.value?.accessToken,
  })

  const engine = createSyncEngine({
    db: options.db,
    client: createHttpSyncClient({ http }),
    deviceId: () => deviceId.current(),
    ownerId: options.ownerId,
    now: () => toIsoDateTime(new Date()),
    nowMs: () => Date.now(),
    random: () => Math.random(),
    refreshToken: () => renewSession(http, session),
  })

  const triggers = await listen(engine, options.db)

  return { engine, triggers }
}

/**
 * Trade the refresh token for a fresh session.
 *
 * Answers `false` on any failure, and — the whole point — **does not end the
 * session**. The student keeps reading what is on the device; only the network
 * half of the app is paused until the next attempt (D-10, AC-22f).
 */
async function renewSession(
  http: HttpClient,
  session: ReturnType<typeof useSession>,
): Promise<boolean> {
  const refreshToken = session.session.value?.refreshToken
  if (refreshToken === undefined) return false

  try {
    const renewed = await http.post<RefreshTokensResponse>(Routes().auth.tokens.refresh(), {
      refreshToken,
    } satisfies RefreshTokensRequest)

    await session.start({
      accessToken: renewed.accessToken,
      refreshToken: renewed.refreshToken,
    })

    return true
  } catch {
    // Reported by returning `false`: the run defers and tries again later. A
    // rethrow here would reach `endSessionOn401` territory, which is exactly
    // what must not happen.
    return false
  }
}

async function listen(engine: SyncEngine, db: IDatabase): Promise<SyncTriggers> {
  let debounce: ReturnType<typeof setTimeout> | null = null

  const now = () => engine.runner.run()

  const soon = () => {
    if (debounce !== null) clearTimeout(debounce)
    debounce = setTimeout(() => {
      debounce = null
      void now()
    }, WRITE_DEBOUNCE_MS)
  }

  // Going to the background: let the page in flight settle and give the lock
  // back before the system decides to take the whole app instead.
  const background = async () => {
    await db.suspend()
  }

  const foreground = () => {
    db.resume()
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
    await db.suspend()
  }

  return { now, soon, stop }
}
