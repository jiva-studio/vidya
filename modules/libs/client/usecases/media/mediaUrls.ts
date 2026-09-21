import type { MediaId, SignedUrl } from '@vidya/domain'
import { MediaPathPrefix, parseMediaPath } from '@vidya/domain'
import type { ResolveMediaRequest, ResolveMediaResponse } from '@vidya/protocol'
import { MediaResolveLimit, Routes } from '@vidya/protocol'

import type { HttpClient } from '../../ports'

/**
 * Turns the path a lesson stores into an address something can play.
 *
 * Reading is synchronous because an element draws before a promise can answer:
 * a screen primes the whole of what it is about to show, and then every read is
 * a lookup. What the school gave no address for stays unresolved rather than
 * failing — an id this reader may not have is absent from the answer, and a
 * screen says so instead of handing a player a source that will be refused.
 */
export interface MediaUrls {
  prime(paths: readonly string[]): Promise<void>
  resolve(path: string): string | undefined
}

export interface MediaUrlsOptions {
  readonly http: HttpClient
  readonly nowMs: () => number
}

export function createMediaUrls(options: MediaUrlsOptions): MediaUrls {
  const held = new Map<MediaId, SignedUrl>()

  // Which request last asked about an id. Two batches naming one file are in
  // flight whenever a screen primes again, and the answers arrive in whatever
  // order the network gives them: without this the older one writes last and
  // erases the grant that replaced it.
  const askedBy = new Map<MediaId, number>()
  let requests = 0

  const askFor = async (ids: readonly MediaId[]): Promise<void> => {
    requests += 1
    const request = requests
    ids.forEach((id) => askedBy.set(id, request))

    const answered = await options.http.post<ResolveMediaResponse>(Routes().media.urls(), {
      ids: [...ids],
    } satisfies ResolveMediaRequest)

    const isCurrent = (id: MediaId): boolean => askedBy.get(id) === request

    // Forgotten rather than kept: an id asked for and not answered is one this
    // reader may no longer read, and an address held from the last batch would
    // outlive the permission that produced it.
    ids.filter(isCurrent).forEach((id) => held.delete(id))
    Object.entries(answered.urls)
      .filter(([id]) => isCurrent(id as MediaId))
      .forEach(([id, signed]) => held.set(id as MediaId, signed))
  }

  const prime = async (paths: readonly string[]): Promise<void> => {
    const ids = [...new Set(paths.map((path) => parseMediaPath(path)).filter(isMediaId))]
    if (ids.length === 0) return

    await Promise.all(splitIntoRequests(ids).map(askFor))
  }

  const resolve = (path: string): string | undefined => {
    if (!path.startsWith(MediaPathPrefix)) return path

    const id = parseMediaPath(path)
    if (id === undefined) return undefined

    const signed = held.get(id)
    if (signed === undefined) return undefined

    return hasExpired(signed, options.nowMs()) ? undefined : signed.url
  }

  return { prime, resolve }
}

const isMediaId = (id: MediaId | undefined): id is MediaId => id !== undefined

/** The server refuses an oversized batch whole, so a long screen is split. */
const splitIntoRequests = (ids: readonly MediaId[]): MediaId[][] =>
  Array.from({ length: Math.ceil(ids.length / MediaResolveLimit) }, (_, at) =>
    ids.slice(at * MediaResolveLimit, (at + 1) * MediaResolveLimit),
  )

/**
 * Whether the window has closed, counting the instant it names as still open.
 *
 * A player handed a dead address gets its next range request refused in the
 * middle of a lecture and has no way to ask for another, so an address past its
 * window is not an address any more.
 */
const hasExpired = (signed: SignedUrl, nowMs: number): boolean =>
  nowMs > Date.parse(signed.expiresAt)
