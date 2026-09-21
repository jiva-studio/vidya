import { MediaId, MediaKind, SchoolId } from '@vidya/domain'

/**
 * What a school may upload, per kind.
 *
 * A white list rather than a blocked list: a type nobody thought about must be
 * refused, not served. `image/svg+xml` is absent on purpose — a browser
 * executes an SVG as a document, so serving one from a school's own origin
 * hands every uploader a script tag.
 */
export const AllowedMimeTypes: Readonly<Record<MediaKind, readonly string[]>> = Object.freeze({
  image: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
})

const EXTENSIONS: Readonly<Record<string, string>> = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'weba',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
})

export const isAllowedMimeType = (kind: MediaKind, mimeType: string): boolean =>
  AllowedMimeTypes[kind].includes(mimeType.toLowerCase())

/** The ceilings deployment sets, named per kind rather than per environment variable. */
export type MediaSizeLimits = {
  maxImageBytes: number
  maxAudioBytes: number
  maxVideoBytes: number
}

export const maxBytesOf = (limits: MediaSizeLimits, kind: MediaKind): number =>
  ({ image: limits.maxImageBytes, audio: limits.maxAudioBytes, video: limits.maxVideoBytes })[kind]

/** Where a school writes when it has not brought a prefix of its own. */
export const defaultPrefixOf = (schoolId: SchoolId): string => `school/${schoolId}`

/**
 * The prefix a school's files live under, read from one place by everything
 * that writes, lists or sweeps them.
 *
 * A stored prefix that is empty or blank is no prefix at all, and reading it as
 * one names every object in the bucket — including another school's.
 */
export const prefixOf = (profile: { schoolId: SchoolId; prefix: string | null }): string =>
  (profile.prefix ?? '').trim() || defaultPrefixOf(profile.schoolId)

/**
 * The object key one upload writes to.
 *
 * The media id is a path segment rather than a suffix so everything belonging
 * to one file — an original today, a poster or a rendition later — shares a
 * folder that can be listed and removed as a whole.
 */
export const storageKeyOf = (
  prefix: string,
  kind: MediaKind,
  mediaId: MediaId,
  mimeType: string,
): string => {
  const base = (prefix || '').replace(/\/+$/, '')
  const extension = EXTENSIONS[mimeType.toLowerCase()] ?? 'bin'

  return [base, kind, mediaId, `original.${extension}`].filter((part) => part.length > 0).join('/')
}
