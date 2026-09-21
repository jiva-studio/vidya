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
 * Whether the school is writing into the installation's bucket rather than one
 * of its own.
 *
 * Read off the probe instead of off the credentials: a school's profile is
 * inserted only once its keys have been used, so it carries either an instant
 * or the refusal that came back, while a lent one carries neither — there is
 * nothing for the school to prove about keys that are not theirs. Comparing
 * the row against the configured storage was rejected as the test, because an
 * installation that changes its default would start showing its old bucket and
 * key id to every school that was lent them.
 */
export const isLentProfile = (profile: StorageProfile): boolean =>
  profile.verifiedAt === null && profile.verifyError === null

/** Whether the school's files sit behind keys of its own rather than the installation's. */
export const hasOwnCredentials = (profile: StorageProfile | null): boolean =>
  profile !== null && !isLentProfile(profile)

/**
 * The profile as anyone is ever allowed to read it back.
 *
 * The secret is not omitted from a wider object — it never enters one. The tail
 * is passed in already cut, so there is no point in this file where the whole
 * secret is in a field that a later addition could serialise by accident.
 *
 * A lent profile answers blank where it would name the installation's bucket
 * and the key that opens it. Blank rather than absent, so one form reads both
 * answers, and blank rather than null for the same reason.
 */
export const toStorageProfileView = (
  profile: StorageProfile,
  secretTail: string,
  occupancy: StorageOccupancy,
): protocol.StorageProfileView => {
  const lent = isLentProfile(profile)

  return {
    id: profile.id,
    schoolId: profile.schoolId,
    provider: profile.provider,
    lent,

    // The host the files are actually at, composed for the providers whose
    // address is ours to compose. Masked rather than omitted when the storage
    // is lent: a composed host names the installation's bucket just as the
    // typed one does.
    endpoint: lent ? '' : storageEndpointFor(profile.provider, profile),

    region: profile.region,
    bucket: lent ? '' : profile.bucket,
    prefix: profile.prefix,
    accessKeyId: lent ? '' : profile.accessKeyId,
    secretTail: lent ? '' : secretTail,
    delivery: profile.delivery,
    publicBaseUrl: profile.publicBaseUrl,
    quotaBytes: occupancy.quotaBytes,
    usedBytes: occupancy.usedBytes,
    verifiedAt: profile.verifiedAt ? toIsoDateTime(profile.verifiedAt) : null,
    verifyError: profile.verifyError,
  }
}
