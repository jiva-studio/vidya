import * as domain from '@vidya/domain'

import * as crud from './crud'

/* -------------------------------------------------------------------------- */
/*                                   Models                                   */
/* -------------------------------------------------------------------------- */

/**
 * A stored file as the library lists it and a block refers to it.
 *
 * `url` is the durable path (`/media/<id>`), never a signed address: a
 * signature outlives neither the lesson nor the key that made it. The playable
 * address is asked for separately, per screen.
 */
export type MediaRecord = {
  id: domain.MediaId
  schoolId: domain.SchoolId
  kind: domain.MediaKind
  status: domain.MediaStatus
  url: string
  name: string
  mimeType: string
  sizeBytes: number

  /** Absent for files uploaded above the hashing limit; those are not deduplicated. */
  sha256?: string

  width?: number
  height?: number
  durationMs?: number
  posterMediaId?: domain.MediaId
  createdAt: domain.IsoDateTime
}

export type MediaSummary = Pick<
  MediaRecord,
  'id' | 'kind' | 'status' | 'url' | 'name' | 'mimeType' | 'sizeBytes' | 'createdAt'
>

export type MediaQuery = {
  schoolId: domain.SchoolId
  term?: string
  kind?: domain.MediaKind
  page?: number
}

export type MediaPage = {
  items: MediaSummary[]
  total: number
  page: number
  pageSize: number
}

export type GetMediaResponse = MediaPage

/* -------------------------------------------------------------------------- */
/*                                   Upload                                   */
/* -------------------------------------------------------------------------- */

/**
 * What the client declares before a single byte moves.
 *
 * The size is declared rather than discovered because the signature is bound to
 * it: a presigned PUT carries no conditions of its own, so the only way to stop
 * a grant from being a licence to upload a terabyte is to sign `Content-Length`
 * and refuse anything else. `sha256` is base64 and optional — above the hashing
 * limit the browser does not pay for it, and those files are not deduplicated.
 */
export type CreateUploadRequest = {
  schoolId: domain.SchoolId
  kind: domain.MediaKind
  name: string
  mimeType: string
  sizeBytes: number
  sha256?: string
}

export type CreateUploadResponse = {
  mediaId: domain.MediaId
  grant: domain.UploadGrant

  /**
   * Whether these bytes take part in deduplication.
   *
   * Said out loud rather than inferred from a missing checksum: above the
   * hashing limit the browser is not asked for a digest, and a client that had
   * to read that from silence could not tell it apart from a grant that simply
   * carries no checksum header on this provider.
   */
  deduplicated: boolean
}

/**
 * Said once the bytes are in place, so the server can believe storage instead
 * of the client: size and type are re-read with a HEAD and compared to the
 * grant.
 */
export type CompleteUploadRequest = {
  sha256?: string
}

export type CompleteUploadResponse = crud.GetItemResponse<MediaRecord>

export type DeleteMediaResponse = crud.DeleteItemResponse

/**
 * Why a file cannot be deleted: it is answered with 409 and the lessons that
 * still use it, because "in use" without naming where is not actionable.
 */
export type MediaInUseResponse = {
  lessons: { lessonId: domain.LessonId; title: string }[]
}

/* -------------------------------------------------------------------------- */
/*                                  Reading                                   */
/* -------------------------------------------------------------------------- */

/**
 * Playable addresses for a whole screen in one call.
 *
 * A batch rather than one call per file: a gallery page holds dozens, and an
 * image element cannot wait for a promise, so a screen resolves everything it
 * is about to draw before it draws it.
 */
export type ResolveMediaRequest = {
  ids: domain.MediaId[]
}

export type ResolveMediaResponse = {
  /**
   * Keyed by media id, holding what this caller may read and nothing else.
   *
   * An id they may not read is absent rather than refused: a screen asking for
   * twelve files must still draw the eleven it is entitled to, and one stale
   * reference in old content cannot be allowed to blank a lesson. Absence also
   * says less than a refusal would — it does not disclose whether the file
   * exists at all, only that this caller gets no address for it.
   */
  urls: Record<string, domain.SignedUrl>
}

/* -------------------------------------------------------------------------- */
/*                              Storage profile                               */
/* -------------------------------------------------------------------------- */

/**
 * The profile as anyone is ever allowed to read it back.
 *
 * The secret is write-only: what comes back is the key id and the last four
 * characters, which is enough to tell two credentials apart and not enough to
 * use one. `delivery` is derived from whether a CDN host is present, not chosen
 * by a person.
 *
 * `lent` says the files live in the installation's own bucket rather than one
 * the school brought. Everything that would reach that bucket — the endpoint,
 * the bucket name, the key id, the tail of the secret — is then absent, because
 * it is not the school's to hold; `prefix` still names where its own files sit.
 */
export type StorageProfileView = {
  id: domain.StorageProfileId
  schoolId: domain.SchoolId
  provider: domain.StorageProvider
  lent: boolean

  /** Only `s3-compatible` carries one; for the rest it is derived and refused here. */
  endpoint: string | null

  region: string
  bucket: string | null
  prefix: string
  accessKeyId: string | null
  secretTail: string
  delivery: domain.StorageDelivery
  publicBaseUrl: string | null
  quotaBytes: number | null
  usedBytes: number
  verifiedAt: domain.IsoDateTime | null

  /** The reason the last probe failed, as a message key rather than a sentence. */
  verifyError: string | null
}

/**
 * New credentials for a school's storage.
 *
 * Applying this never edits the profile in place: it retires the current one
 * and points the school at a new row, because files already uploaded are read
 * through the profile that wrote them. Rotating a key under existing content
 * would otherwise break every file the school has published.
 */
export type UpsertStorageProfileRequest = {
  provider: domain.StorageProvider

  /** Required for `s3-compatible`, refused for the rest: theirs is derived. */
  endpoint?: string

  region: string

  /** R2 addresses by account rather than by region, and has no regions. */
  r2AccountId?: string

  bucket: string
  prefix?: string
  accessKeyId: string
  secret: string
  publicBaseUrl?: string
  tokenSecret?: string
  quotaBytes?: number
}

export type UpsertStorageProfileResponse = crud.GetItemResponse<StorageProfileView>
export type GetStorageProfileResponse = crud.GetItemResponse<StorageProfileView | null>
export type VerifyStorageProfileResponse = crud.GetItemResponse<StorageProfileView>

export type StorageUsageResponse = {
  usedBytes: number

  /** Bytes promised to grants that have not completed; they count against the quota. */
  reservedBytes: number

  quotaBytes: number | null
  countsByKind: Record<domain.MediaKind, number>
}

/* -------------------------------------------------------------------------- */
/*                                  Refusals                                  */
/* -------------------------------------------------------------------------- */

/**
 * Message keys a client shows, paired with the status they arrive as. Declared
 * here so the admin's locales and the API's exceptions cannot drift apart.
 */
export const MediaRefusals = Object.freeze({
  quotaExceeded: 'media-quota-exceeded',
  tooLarge: 'media-too-large',
  typeNotAllowed: 'media-type-not-allowed',
  notReady: 'media-not-ready',
  inUse: 'media-in-use',

  // Content naming a file this school does not have. Another school's id is
  // unknown in exactly the same way: a lesson may only point at its own
  // library, and a save that would dangle is refused rather than stored.
  unknownMedia: 'media-unknown',

  // Three ways storage can say no, and a school acts on each differently:
  // we refused to dial the address, we dialled and were turned away, we
  // dialled and nothing answered.
  endpointRejected: 'storage-endpoint-rejected',
  credentialsRejected: 'storage-credentials-rejected',
  storageUnreachable: 'storage-unreachable',

  // The stored secret will not decrypt — ours to explain, theirs to re-enter.
  secretUnreadable: 'storage-secret-unreadable',

  // This profile cannot sign a whole catalogue, only one object at a time.
  streamUnsupported: 'storage-stream-unsupported',

  // Somebody else rotated the same school's keys first: what is live now is
  // not what this request started from, so it is read again and re-sent.
  rotationConflicted: 'storage-rotation-conflicted',

  // A stored ceiling that cannot be carried exactly — refused rather than
  // answered with a different number than the one in the column.
  quotaUnreadable: 'storage-quota-unreadable',

  notConfigured: 'storage-not-configured',
} as const)

export type MediaRefusal = (typeof MediaRefusals)[keyof typeof MediaRefusals]

export { MediaResolveLimit } from '@vidya/domain'
