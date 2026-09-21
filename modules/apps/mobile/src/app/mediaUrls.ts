import type { HttpClient, HttpQuery, MediaUrls } from '@vidya/client'
import { createMediaUrls } from '@vidya/client'

import { NoConnectionError } from './repositories'
import { runningSyncs } from './sync'

/**
 * Playable addresses for the school files a screen is about to draw.
 *
 * One resolver for the app rather than one per screen: the addresses it has
 * been given are good for hours, and a screen opened twice would otherwise ask
 * the school again for what the last one already holds.
 *
 * The transport is resolved per request instead of being captured, for the same
 * reason the repositories resolve theirs: which connection is running changes
 * at sign-in and at sign-out, and a resolver built at launch would hold a
 * client for a school the student has left.
 */
let shared: MediaUrls | undefined

export function useMediaUrls(): MediaUrls {
  shared ??= createMediaUrls({ http: connectionHttp, nowMs: () => Date.now() })

  return shared
}

const currentClient = (): HttpClient => {
  const started = runningSyncs()[0]
  if (started === undefined) throw new NoConnectionError()

  return started.http
}

const connectionHttp: HttpClient = {
  get: <TResponse>(path: string, query?: HttpQuery) => currentClient().get<TResponse>(path, query),
  post: <TResponse>(path: string, body?: unknown) => currentClient().post<TResponse>(path, body),
  patch: <TResponse>(path: string, body?: unknown) => currentClient().patch<TResponse>(path, body),
  delete: (path: string) => currentClient().delete(path),
}
