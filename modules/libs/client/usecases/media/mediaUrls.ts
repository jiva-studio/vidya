import type { MediaId, SignedUrl } from '@vidya/domain'
import { parseMediaPath } from '@vidya/domain'
import type { ResolveMediaRequest, ResolveMediaResponse } from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

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

  const prime = async (paths: readonly string[]): Promise<void> => {
    const ids = [...new Set(paths.map((path) => parseMediaPath(path)).filter(isMediaId))]
    if (ids.length === 0) return

    const answered = await options.http.post<ResolveMediaResponse>(Routes().media.urls(), {
      ids,
    } satisfies ResolveMediaRequest)

    // Forgotten rather than kept: an id asked for and not answered is one this
    // reader may no longer read, and an address held from the last batch would
    // outlive the permission that produced it.
    ids.forEach((id) => held.delete(id))
    Object.entries(answered.urls).forEach(([id, signed]) => held.set(id as MediaId, signed))
  }

  const resolve = (path: string): string | undefined => {
    const id = parseMediaPath(path)
    if (id === undefined) return path

    const signed = held.get(id)
    if (signed === undefined) return undefined

    return hasExpired(signed, options.nowMs()) ? undefined : signed.url
  }

  return { prime, resolve }
}

const isMediaId = (id: MediaId | undefined): id is MediaId => id !== undefined

/**
 * Whether the window has closed, counting the instant it names as still open.
 *
 * A player handed a dead address gets its next range request refused in the
 * middle of a lecture and has no way to ask for another, so an address past its
 * window is not an address any more.
 */
const hasExpired = (signed: SignedUrl, nowMs: number): boolean =>
  nowMs > Date.parse(signed.expiresAt)
