import type { HttpClient, MediaUrls } from '@vidya/client'
import { createMediaUrls } from '@vidya/client'

import { NoConnectionError } from './repositories'
import { runningSyncs, type StartedSync } from './sync'

/**
 * Playable addresses for the school files a screen is about to draw.
 *
 * One resolver per connection, the way the repositories resolve their ports:
 * a read signature lasts hours and needs no session to be used, so a resolver
 * shared by the app would answer for a school the student has signed out of or
 * switched away from. A screen holds this facade rather than the resolver
 * behind it, so what a mounted screen reads follows the connection.
 */
export function useMediaUrls(): MediaUrls {
  return {
    prime: async (paths) => {
      const started = runningSyncs()[0]
      if (started === undefined) throw new NoConnectionError()

      await resolverFor(started).prime(paths)
    },

    resolve: (path) => currentResolver().resolve(path),
  }
}

const perConnection = new WeakMap<StartedSync, MediaUrls>()

const currentResolver = (): MediaUrls => {
  const started = runningSyncs()[0]

  return started === undefined ? unsigned : resolverFor(started)
}

const resolverFor = (started: StartedSync): MediaUrls => {
  const held = perConnection.get(started)
  if (held !== undefined) return held

  const created = createMediaUrls({ http: started.http, nowMs: () => Date.now() })
  perConnection.set(started, created)

  return created
}

const refuse = (): never => {
  throw new NoConnectionError()
}

/**
 * What can still be answered while the app holds no connection.
 *
 * Built from the same factory so the line between a stored path and a link that
 * needs no signature is drawn in one place. Nothing ever primes it, so every
 * `/media/` path is unanswered and no address outlives the connection that
 * earned it — while a lesson pointing at someone else's server reads the same
 * signed in and signed out.
 */
const unsigned = createMediaUrls({
  http: { get: refuse, post: refuse, patch: refuse, delete: refuse } satisfies HttpClient,
  nowMs: () => Date.now(),
})
