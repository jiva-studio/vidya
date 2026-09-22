import { randomUUID } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { MediaConfig } from '@vidya/api/configs'
import { deliveryFor } from '@vidya/api/media/mappers'
import { SchoolId, StorageProfileId } from '@vidya/domain'
import { StorageProfile } from '@vidya/entities'

import { StorageFailedError } from '../storageFailure'
import { defaultPrefixOf } from './mediaLimits'
import { SecretSealingService } from './secretSealing.service'
import { StorageProfileDraft, StorageProfilesService } from './storageProfiles.service'

type DefaultStorage = ConfigType<typeof MediaConfig>['defaultStorage']

/**
 * The storage of the installation, given to a school that brought none.
 *
 * Deployment configuration cannot serve as a profile on its own: every file
 * names the profile it was written through, so a school on the installation's
 * bucket gets a row of its own, under `school/<schoolId>`. The room it may
 * take is not on that row — a school nobody decided a ceiling for stores under
 * the installation's default, which stays the deployment's to change.
 *
 * The row is written when the school first needs it rather than by a
 * migration, so the credentials come from the environment the deployment is
 * running with and no school is handed a bucket it never uploads to.
 */
@Injectable()
export class InstallationStorageService {
  constructor(
    @Inject(MediaConfig.KEY) private readonly config: ConfigType<typeof MediaConfig>,
    private readonly profiles: StorageProfilesService,
    private readonly sealing: SecretSealingService,
  ) {}

  /**
   * The school's row on the installation's bucket, written once.
   *
   * Two uploads starting together must not open two buckets, and the school
   * has at most one live profile by index. The insert is allowed to lose: the
   * caller that conflicts reads back the row the winner wrote, outside its own
   * transaction, so it sees a row that has since been committed.
   */
  async provisionProfileFor(schoolId: SchoolId): Promise<StorageProfile> {
    const written = await this.profiles.insertIfAbsent(this.draftFor(schoolId))
    if (written) return written

    const live = await this.profiles.findCurrentFor(schoolId)
    if (!live) throw new StorageFailedError('not-configured')

    return live
  }

  private draftFor(schoolId: SchoolId): StorageProfileDraft {
    const storage = this.requireDefaultStorage()
    const profileId = randomUUID() as StorageProfileId

    return {
      id: profileId,
      schoolId,

      // The address is deployment's to name, so the lent row is the one shape
      // that carries an endpoint of its own rather than a composed host.
      provider: 's3-compatible',
      endpoint: storage.endpoint,

      region: storage.region,
      r2AccountId: null,
      bucket: storage.bucket,
      prefix: defaultPrefixOf(schoolId),
      accessKeyId: storage.accessKeyId,
      delivery: deliveryFor(storage.publicBaseUrl, null),
      publicBaseUrl: storage.publicBaseUrl,
      secrets: this.sealing.sealProfile({ secret: storage.secret }, { schoolId, profileId }),

      // Nothing probed these credentials, and no school could act on their
      // being wrong: they are the installation's to prove, not the school's.
      verifiedAt: null,
    }
  }

  /** An installation is allowed to have no storage of its own; it then has none to lend. */
  private requireDefaultStorage(): DefaultStorage {
    const storage = this.config.defaultStorage

    if (!storage.endpoint || !storage.bucket) throw new StorageFailedError('not-configured')

    return storage
  }
}
