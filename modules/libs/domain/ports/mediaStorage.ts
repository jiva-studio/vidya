import { MediaKind, SignedUrl, StoredObject, UploadGrant, UploadLimits } from '../media'

/**
 * What the application asks of a school's storage.
 *
 * There is no `put`: the only writer of bytes is the browser, holding a
 * signature. Adding one would give the API a second path to the same object —
 * the path we refuse to have, because it puts our process in front of every
 * upload and every playback and bills us for the traffic twice.
 */
export interface MediaStoragePort {
  /** Permission to write one object, bound to the declared size and type. */
  signUpload(key: string, limits: UploadLimits): Promise<UploadGrant>

  /**
   * Permission to read one object until `expiresAt`.
   *
   * `kind` decides the window rather than the caller: six hours for audio and
   * video, one for an image (see `ReadWindowSeconds`).
   */
  signRead(key: string, kind: MediaKind): Promise<SignedUrl>

  /**
   * Permission to read everything under a prefix.
   *
   * Separate from `signRead` because a stream is not a file: a player fetches a
   * manifest and then hundreds of segments by relative path, and signing them
   * one at a time is not something a manifest can express. A provider that
   * cannot sign a prefix refuses this call instead of returning a signature for
   * the manifest alone, which would fail on the first segment.
   */
  signStream(prefix: string, kind: MediaKind): Promise<SignedUrl>

  /** The object as storage has it, or nothing when the bytes never landed. */
  head(key: string): Promise<StoredObject | undefined>

  remove(key: string): Promise<void>

  /** Everything under a prefix, for recounting what a school occupies. */
  listPrefix(prefix: string): AsyncIterable<StoredObject>

  /**
   * Upload sessions begun and never finished, and the means to end them.
   *
   * Listed separately because they are invisible to `listPrefix` while still
   * occupying paid space, and the lifecycle rule that would expire them does
   * not exist on every provider — Bunny has none at all.
   */
  listUnfinished(prefix: string): AsyncIterable<{ key: string; uploadId: string; startedAt: Date }>
  abortUnfinished(key: string, uploadId: string): Promise<void>
}
