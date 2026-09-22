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
 * A school storing in the installation's bucket: which school, and where under
 * that bucket its own files sit.
 */
export type StorageLease = {
  schoolId: domain.SchoolId
  prefix: string
}

/**
 * The profile as anyone is ever allowed to read it back.
 *
 * The secret is not omitted from a wider object — it never enters one. The tail
 * is passed in already cut, so there is no point in this file where the whole
 * secret is in a field that a later addition could serialise by accident.
 *
 * A lease means the bucket is the installation's rather than the school's, and
 * then everything that would reach it is left out: a school lent a bucket is
 * told that it is lent one and where its own files live, not the address, the
 * bucket, the key id or any part of the secret that opens it.
 */
export const toStorageProfileView = (
  profile: StorageProfile,
  secretTail: string,
  occupancy: StorageOccupancy,
  lease?: StorageLease,
): protocol.StorageProfileView => ({
  id: profile.id,
  schoolId: lease?.schoolId ?? profile.schoolId,

  provider: profile.provider,
  lent: lease !== undefined,
  ...reachOf(profile, secretTail, lease),

  region: profile.region,
  prefix: lease?.prefix ?? profile.prefix,
  delivery: profile.delivery,
  quotaBytes: occupancy.quotaBytes,
  usedBytes: occupancy.usedBytes,
  verifiedAt: profile.verifiedAt ? toIsoDateTime(profile.verifiedAt) : null,
  verifyError: profile.verifyError,
})

/** Everything that would reach the bucket, and nothing where the bucket is lent. */
const reachOf = (profile: StorageProfile, secretTail: string, lease?: StorageLease) =>
  lease
    ? { endpoint: null, bucket: null, accessKeyId: null, secretTail: '', publicBaseUrl: null }
    : {
        // The host the files are actually at: composed for the providers whose
        // address is ours to compose, and the school's own where it typed one.
        endpoint: storageEndpointFor(profile.provider, profile),

        bucket: profile.bucket,
        accessKeyId: profile.accessKeyId,
        secretTail,
        publicBaseUrl: profile.publicBaseUrl,
      }
