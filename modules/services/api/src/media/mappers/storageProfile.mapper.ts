import * as domain from '@vidya/domain'
import { toIsoDateTime } from '@vidya/domain'
import { StorageProfile } from '@vidya/entities'
import * as protocol from '@vidya/protocol'

const SECRET_TAIL_LENGTH = 4

/**
 * How reads are authorised, worked out from what the profile holds.
 *
 * A school enters credentials, never a delivery mode: a CDN host means the CDN
 * serves, and whether it signs depends on whether a token secret came with it.
 * No host at all leaves the storage endpoint to sign for itself.
 */
export const deliveryFor = (
  publicBaseUrl: string | null | undefined,
  tokenSecret: string | null | undefined,
): domain.StorageDelivery => {
  if (!publicBaseUrl) return 'presigned'

  return tokenSecret ? 'bunny-token' : 'public'
}

/** The last characters of a secret: enough to tell two apart, not enough to use one. */
export const secretTailOf = (secret: string): string => secret.slice(-SECRET_TAIL_LENGTH)

/**
 * The video provider, or none at all.
 *
 * A union cannot be checked by a field decorator, and this value goes into a
 * `json` column, so whatever arrives would be stored and read back as a
 * provider later. Anything that is not a complete provider is therefore read
 * as `none` here rather than kept for a reader to trip over.
 */
export const videoProviderOf = (value: domain.VideoProvider | undefined): domain.VideoProvider => {
  if (value?.kind !== 'bunny-stream') return { kind: 'none' }

  const { libraryId, pullZoneHost } = value
  if (typeof libraryId !== 'string' || typeof pullZoneHost !== 'string') return { kind: 'none' }
  if (libraryId.length === 0 || pullZoneHost.length === 0) return { kind: 'none' }

  return { kind: 'bunny-stream', libraryId, pullZoneHost }
}

/**
 * The profile as anyone is ever allowed to read it back.
 *
 * The secret is not omitted from a wider object — it never enters one. The tail
 * is passed in already cut, so there is no point in this file where the whole
 * secret is in a field that a later addition could serialise by accident.
 */
export const toStorageProfileView = (
  profile: StorageProfile,
  secretTail: string,
): protocol.StorageProfileView => ({
  id: profile.id,
  schoolId: profile.schoolId as protocol.StorageProfileView['schoolId'],
  kind: profile.kind,
  endpoint: profile.endpoint,
  region: profile.region,
  bucket: profile.bucket,
  prefix: profile.prefix,
  accessKeyId: profile.accessKeyId,
  secretTail,
  delivery: profile.delivery,
  publicBaseUrl: profile.publicBaseUrl,
  video: profile.video,
  quotaBytes: profile.quotaBytes === null ? null : Number(profile.quotaBytes),
  usedBytes: Number(profile.usedBytes),
  verifiedAt: profile.verifiedAt ? toIsoDateTime(profile.verifiedAt) : null,
  verifyError: profile.verifyError,
})
