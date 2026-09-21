import * as domain from '@vidya/domain'
import { toIsoDateTime } from '@vidya/domain'
import { StorageProfile } from '@vidya/entities'
import * as protocol from '@vidya/protocol'

import { storageEndpointFor } from '../services/storageAddress'

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
 * What a school occupies and what it may occupy, neither of which is on the
 * profile: the first is the sum of its ready files, the second its own policy
 * row.
 */
export type StorageOccupancy = {
  usedBytes: number
  quotaBytes: number | null
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
  occupancy: StorageOccupancy,
): protocol.StorageProfileView => ({
  id: profile.id,
  schoolId: profile.schoolId,

  provider: profile.provider,

  // The host the files are actually at: composed for the providers whose
  // address is ours to compose, and the school's own where it typed one.
  endpoint: storageEndpointFor(profile.provider, profile),

  region: profile.region,
  bucket: profile.bucket,
  prefix: profile.prefix,
  accessKeyId: profile.accessKeyId,
  secretTail,
  delivery: profile.delivery,
  publicBaseUrl: profile.publicBaseUrl,
  quotaBytes: occupancy.quotaBytes,
  usedBytes: occupancy.usedBytes,
  verifiedAt: profile.verifiedAt ? toIsoDateTime(profile.verifiedAt) : null,
  verifyError: profile.verifyError,
})
