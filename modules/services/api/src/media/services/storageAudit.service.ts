import { Injectable } from '@nestjs/common'
import { secretTailOf } from '@vidya/api/media/mappers'
import { AuditLogService } from '@vidya/api/shared/services'
import { SchoolId, StorageProfileId, UserId } from '@vidya/domain'
import * as protocol from '@vidya/protocol'

import { StorageFailedError, StorageFailure } from '../storageFailure'

const PROBE_OUTCOMES: readonly StorageFailure[] = [
  'credentials-rejected',
  'unreachable',
  'secret-unreadable',
]

/**
 * Whether the keys were actually tried.
 *
 * An address we would not dial, storage nobody has configured and a rotation
 * somebody else won say nothing about a school's keys: recording them as failed
 * verifications would fill the trail with events about nothing, and the first of
 * them would put the address that was refused — credentials and all — in it.
 */
const isProbeOutcome = (failure: unknown): failure is StorageFailedError =>
  failure instanceof StorageFailedError && PROBE_OUTCOMES.includes(failure.failure)

/** What a school's storage is, said without saying anything that reaches it. */
type StorageNames = {
  endpoint: string | null
  bucket: string
  accessKeyId: string
  secretTail: string
}

/** What the trail may name about credentials on their way in; never the secret. */
const namesAsked = (request: protocol.UpsertStorageProfileRequest): StorageNames => ({
  endpoint: request.endpoint ?? null,
  bucket: request.bucket,
  accessKeyId: request.accessKeyId,
  secretTail: secretTailOf(request.secret),
})

/**
 * The same for storage already configured, and nothing at all for a bucket the
 * installation lends: that one is not the school's to be told about, so it is
 * not the school's trail to appear in either.
 */
const namesStored = (profile: protocol.StorageProfileView | null): StorageNames =>
  !profile || profile.lent
    ? { endpoint: null, bucket: '', accessKeyId: '', secretTail: '' }
    : {
        endpoint: profile.endpoint,
        bucket: profile.bucket ?? '',
        accessKeyId: profile.accessKeyId ?? '',
        secretTail: profile.secretTail,
      }

/**
 * The trail a school's storage leaves.
 *
 * It is written beside the action rather than inside `StorageSetupService`
 * because who acted is the request's to know, and because the row has to be
 * written on the way out of a refusal as well as a success. What may be named
 * is the key id, the bucket, the address and the last four characters of the
 * secret: enough to tell which credentials were handed over and useless to
 * anyone who reads the table.
 */
@Injectable()
export class StorageAuditService {
  constructor(private readonly auditLog: AuditLogService) {}

  async recordConfigured(
    actorUserId: UserId,
    schoolId: SchoolId,
    profile: protocol.StorageProfileView,
    secret: string,
  ): Promise<void> {
    await this.auditLog.record({
      action: 'media.storage.configured',
      actorUserId,
      schoolId,
      subjectType: 'storage-profile',
      subjectId: profile.id,
      payload: {
        profileId: profile.id,
        ...namesOf({
          endpoint: profile.endpoint,
          bucket: profile.bucket ?? '',
          accessKeyId: profile.accessKeyId ?? '',
          secretTail: secretTailOf(secret),
        }),
      },
    })
  }

  async recordRetired(
    actorUserId: UserId,
    schoolId: SchoolId,
    profileId: StorageProfileId,
  ): Promise<void> {
    await this.auditLog.record({
      action: 'media.storage.retired',
      actorUserId,
      schoolId,
      subjectType: 'storage-profile',
      subjectId: profileId,
      payload: { profileId },
    })
  }

  /** Records credentials the storage turned away, naming them but not carrying them. */
  async recordAskRefused(
    actorUserId: UserId,
    schoolId: SchoolId,
    request: protocol.UpsertStorageProfileRequest,
    failure: unknown,
  ): Promise<void> {
    await this.recordVerifyFailed(actorUserId, schoolId, namesAsked(request), failure)
  }

  /**
   * The same for a profile already stored, which is read only if there is going
   * to be a row: a school lent the installation's bucket has no profile of its
   * own, and asking for one would create the lent row as a side effect of a
   * verify that failed.
   */
  async recordVerifyRefused(
    actorUserId: UserId,
    schoolId: SchoolId,
    failure: unknown,
    readProfile: () => Promise<protocol.StorageProfileView | null>,
  ): Promise<void> {
    if (!isProbeOutcome(failure)) return

    await this.recordVerifyFailed(actorUserId, schoolId, namesStored(await readProfile()), failure)
  }

  /**
   * The outcome is the message key the school was answered with: the trail has
   * to say why the keys were refused, and the only other detail a storage
   * refusal carries is the credential itself.
   */
  private async recordVerifyFailed(
    actorUserId: UserId,
    schoolId: SchoolId,
    names: StorageNames,
    failure: unknown,
  ): Promise<void> {
    if (!isProbeOutcome(failure)) return

    await this.auditLog.record({
      action: 'media.storage.verifyFailed',
      actorUserId,
      schoolId,
      subjectType: 'storage-profile',
      payload: { ...namesOf(names), outcome: failure.refusal },
    })
  }
}

/** Nothing empty and nothing null, so a payload names what it has and no more. */
const namesOf = (names: StorageNames): Record<string, string> =>
  Object.fromEntries(Object.entries(names).filter(([, value]) => Boolean(value)))
