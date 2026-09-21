/**
 * What a stored file is, and how a lesson addresses one.
 *
 * Lives in `domain` rather than `protocol` because the same vocabulary is used
 * by the database CHECK constraints, the entities and the wire; declaring it
 * once is what keeps a state from being added to the schema and forgotten on
 * the wire. `protocol` re-exports it.
 */

import { IsoDateTime, MediaId } from './identity'

export const MediaKinds = ['image', 'video', 'audio'] as const
export type MediaKind = (typeof MediaKinds)[number]

/**
 * A row exists before the bytes do: the id is part of the object key, so it has
 * to be handed out before an upload can be signed. `failed` is kept rather than
 * deleted so a refused upload can be told apart from one that never started.
 */
export const MediaStatuses = ['pending', 'ready', 'failed', 'archived'] as const
export type MediaStatus = (typeof MediaStatuses)[number]

/**
 * How a read is authorised, decided by what the profile holds rather than by a
 * person choosing: a CDN host means the CDN signs, its absence means the
 * storage endpoint signs, and `public` is for a bucket that is open by design.
 */
export const StorageDeliveries = ['presigned', 'bunny-token', 'public'] as const
export type StorageDelivery = (typeof StorageDeliveries)[number]

/** Only S3-compatible storage is supported; Bunny, R2, MinIO and AWS all are. */
export const StorageProfileKinds = ['s3'] as const
export type StorageProfileKind = (typeof StorageProfileKinds)[number]

/**
 * Adaptive bitrate is a property of transcoding, not of storage, so it arrives
 * as a provider beside the bucket rather than as a flag on it. `none` means the
 * original is served as it was uploaded: one quality, byte ranges, no manifest.
 */
export type VideoProvider =
  { kind: 'none' } | { kind: 'bunny-stream'; libraryId: string; pullZoneHost: string }

/* -------------------------------------------------------------------------- */
/*                            Addressing a file                               */
/* -------------------------------------------------------------------------- */

/**
 * What lesson content stores for an uploaded file: a path on the serving
 * origin, never a signed address.
 *
 * A signature outlives neither the lesson nor the key that made it, and the
 * storage a school uses can change under content that is already published —
 * so the durable form is the id, and the playable address is issued on read.
 * A custom scheme was rejected: `edit-lesson-content/model/urls.ts` already
 * accepts a same-origin path and refuses everything that is not `http(s)`.
 */
export const MediaPathPrefix = '/media/'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const mediaPath = (id: MediaId): string => `${MediaPathPrefix}${id}`

/**
 * The id inside a stored path, or nothing when the string is not one.
 *
 * The shape is checked rather than the prefix stripped: `/media/../secrets` and
 * `/media/` both begin correctly and name no file.
 */
export const parseMediaPath = (url: string): MediaId | undefined => {
  if (!url.startsWith(MediaPathPrefix)) return undefined

  const candidate = url.slice(MediaPathPrefix.length)
  return UUID.test(candidate) ? (candidate as MediaId) : undefined
}

export const isMediaPath = (url: string): boolean => parseMediaPath(url) !== undefined

/* -------------------------------------------------------------------------- */
/*                           Signature windows                                */
/* -------------------------------------------------------------------------- */

/**
 * How long a read signature lives, per kind.
 *
 * Audio and video get six hours because a signature that expires mid-lecture
 * stops playback: the range request that follows it is refused, and the player
 * has no way to ask for more without being told to. An image needs no such
 * room.
 */
export const ReadWindowSeconds: Readonly<Record<MediaKind, number>> = Object.freeze({
  image: 3600,
  audio: 21600,
  video: 21600,
})

/**
 * The expiry every reader of the same file inside the same window is given.
 *
 * Rounded up to the window boundary on purpose: a signature minted at "now plus
 * an hour" is unique per reader, and a unique query string is a cache miss at
 * the CDN and in the browser for every single view. Equal expiry makes the
 * address shareable, which it is anyway — a signature can be forwarded whatever
 * its expiry — so nothing is given up by making it cacheable.
 *
 * Rounding alone would hand the reader who arrives near a boundary whatever is
 * left of the window, which is why the next boundary is taken once the
 * remainder falls under half a window: six hours were chosen so that a
 * signature outlasts a two-hour lecture, and three hours still do. The grid is
 * kept either way — an expiry is always a multiple of the window — so readers
 * of one file inside one window are still handed one address.
 */
export const windowExpiry = (nowMs: number, windowSeconds: number): number => {
  const window = windowSeconds * 1000
  const boundary = Math.ceil((nowMs + 1) / window) * window

  return boundary - nowMs < window / 2 ? boundary + window : boundary
}

/* -------------------------------------------------------------------------- */
/*                                   Limits                                   */
/* -------------------------------------------------------------------------- */

/**
 * How many files one batch of addresses may name.
 *
 * The server refuses a larger request whole, which would take down every file
 * on a screen rather than the last one, so the client splits by the same number
 * the server validates against.
 */
export const MediaResolveLimit = 100

/** What an upload declares in advance, and what the signature is bound to. */
export type UploadLimits = {
  contentType: string
  sizeBytes: number

  /**
   * Base64 SHA-256, when the client computed one. Absent above the hashing
   * limit: hashing two gigabytes in a browser costs more than the integrity
   * check is worth, and deduplication is skipped for those files rather than
   * pretended.
   */
  sha256?: string
}

/** An object as storage describes it, which is the only description trusted. */
export type StoredObject = {
  key: string
  sizeBytes: number
  contentType: string
  sha256?: string
}

/** A signed address and the instant it stops working. */
export type SignedUrl = {
  url: string
  expiresAt: IsoDateTime
}

/**
 * Permission to write one object, as the browser will use it.
 *
 * `put` binds size and type by signing their headers, which is the only way to
 * bind them on a provider without POST policies — Bunny has none. `post`
 * carries the policy form fields instead, and `fields` is empty for `put`.
 */
export type UploadGrant = {
  method: 'put' | 'post'
  url: string
  headers: Readonly<Record<string, string>>
  fields: Readonly<Record<string, string>>
  expiresAt: IsoDateTime
}
