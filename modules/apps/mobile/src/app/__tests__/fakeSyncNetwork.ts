import { FakeSyncServer } from '@vidya/client/testing'
import type {
  AckCursorRequest,
  GetProfileResponse,
  PullRequest,
  PushRequest,
  RefreshTokensResponse,
} from '@vidya/protocol'

/**
 * Several servers behind one `fetch`, so a test can watch what leaves the app.
 *
 * The composition root builds its own transport from a connection's `baseUrl`,
 * which is the whole point of having connections at all — so the seam a test
 * can hold is `fetch` itself and nothing above it. Routing by address is what
 * makes "this token went to that server" an observation rather than a belief.
 *
 * The sync half is the same {@link FakeSyncServer} the engine tests drive; only
 * the wire in front of it is new. Auth is answered here because the engine
 * never sees it: a run renews its own token, and the renewal is a request like
 * any other.
 */

export interface RecordedRequest {
  readonly baseUrl: string
  readonly path: string
  readonly method: string

  /** The bearer token the request carried, or `null` when it carried none. */
  readonly token: string | null

  /** The parsed request body, so a test can read the cursors a pull asked from. */
  readonly body: Record<string, unknown> | undefined
}

export interface ServerStub {
  /** The journal and the pull/push behaviour, shared with the engine tests. */
  readonly sync: FakeSyncServer

  readonly ownerId: string
  readonly accessToken: string
  readonly refreshToken: string

  /** Every request bearing the current token is refused, as an expiry looks. */
  expired: boolean

  /** The renewal is refused too, which is what leaves a connection stranded. */
  refreshRefused: boolean
}

export interface FakeNetwork {
  /** Adds a server at `baseUrl`, answering for `ownerId`. */
  add(baseUrl: string, ownerId: string): ServerStub

  server(baseUrl: string): ServerStub

  readonly requests: readonly RecordedRequest[]
  requestsTo(baseUrl: string): RecordedRequest[]

  /**
   * Requests sent to an address no connection names.
   *
   * There is no shared client any more: a transport is built from the
   * connection it serves and closes over that address. A stray is that rule
   * broken — a caller that reached a default base URL instead of a connection's
   * — and it is recorded rather than only thrown, so the failure names the
   * address instead of arriving as an offline error three layers up.
   */
  readonly strays: readonly RecordedRequest[]

  install(): void
  restore(): void
}

/** Yields the event loop without a timer, so ordering stays deterministic. */
export const ticks = async (count: number): Promise<void> => {
  for (let index = 0; index < count; index += 1) await Promise.resolve()
}

export function fakeSyncNetwork(): FakeNetwork {
  const servers = new Map<string, ServerStub>()
  const requests: RecordedRequest[] = []
  const strays: RecordedRequest[] = []
  const original = globalThis.fetch

  const recorded = (baseUrl: string, path: string, init?: RequestInit): RecordedRequest => ({
    baseUrl,
    path,
    method: init?.method ?? 'GET',
    token: bearerOf(init),
    body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
  })

  const handler = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input)
    const entry = [...servers.entries()].find(([baseUrl]) => url.startsWith(baseUrl))
    if (entry === undefined) {
      strays.push(recorded(url, '', init))
      throw new TypeError(`nothing is listening on ${url}`)
    }

    const [baseUrl, server] = entry
    const token = bearerOf(init)
    requests.push(recorded(baseUrl, url.slice(baseUrl.length), init))

    // A few turns of the loop, so two runs that are free to interleave do.
    await ticks(3)

    return answer(server, url.slice(baseUrl.length), token, init)
  }

  return {
    add(baseUrl, ownerId) {
      const stub: ServerStub = {
        sync: new FakeSyncServer(),
        ownerId,
        accessToken: `access-${ownerId}`,
        refreshToken: `refresh-${ownerId}`,
        expired: false,
        refreshRefused: false,
      }
      servers.set(baseUrl, stub)
      return stub
    },

    server: (baseUrl) => {
      const stub = servers.get(baseUrl)
      if (stub === undefined) throw new Error(`no stub for ${baseUrl}`)
      return stub
    },

    requests,
    requestsTo: (baseUrl) => requests.filter((request) => request.baseUrl === baseUrl),
    strays,

    install() {
      globalThis.fetch = handler as typeof globalThis.fetch
    },

    restore() {
      globalThis.fetch = original
      requests.length = 0
      strays.length = 0
      servers.clear()
    },
  }
}

/* -------------------------------------------------------------------------- */
/*                               Answering a call                             */
/* -------------------------------------------------------------------------- */

async function answer(
  server: ServerStub,
  path: string,
  token: string | null,
  init?: RequestInit,
): Promise<Response> {
  const body: unknown = init?.body === undefined ? undefined : JSON.parse(String(init.body))

  if (path === '/auth/refresh') {
    if (server.refreshRefused) return reply(401, {})
    return reply(200, {
      accessToken: server.accessToken,
      refreshToken: server.refreshToken,
    } satisfies RefreshTokensResponse)
  }

  if (token !== server.accessToken || server.expired) return reply(401, {})

  if (path === '/auth/profile') {
    return reply(200, {
      userId: server.ownerId,
      email: `${server.ownerId}@example.test`,
      name: server.ownerId,
    } as GetProfileResponse)
  }

  return syncCall(server, path, body)
}

/**
 * The wire carries JSON, so the shape is asserted at this one boundary.
 *
 * The device's own request types are what the engine already builds; the cast
 * is what a real server would do when it parses a body, and keeping it here
 * means nothing above has to pretend the wire is typed.
 */
async function syncCall(server: ServerStub, path: string, body: unknown): Promise<Response> {
  if (path === '/sync/pull') return reply(200, await server.sync.pull(body as PullRequest))
  if (path === '/sync/push') return reply(200, await server.sync.push(body as PushRequest))
  if (path === '/sync/cursor') {
    await server.sync.ackCursor(body as AckCursorRequest)
    return reply(204, {})
  }

  return reply(404, {})
}

const reply = (status: number, body: unknown): Response =>
  ({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  }) as Response

function bearerOf(init?: RequestInit): string | null {
  const headers = (init?.headers ?? {}) as Record<string, string>
  const raw = headers.authorization ?? headers.Authorization
  return raw === undefined ? null : raw.replace(/^Bearer /, '')
}
