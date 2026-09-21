import { Inject, Injectable } from '@nestjs/common'
import { MediaStoragePort, SchoolId, StorageProfileId } from '@vidya/domain'
import { StorageProfile } from '@vidya/entities'

import { MEDIA_STORAGE, MediaStorageFactory, StorageCredentials } from '../infra/ports'
import { StorageFailedError } from '../storageFailure'
import { SecretSealingService } from './secretSealing.service'
import { StorageProfilesService } from './storageProfiles.service'

/** A bucket a school's files live in, together with the row that named it. */
export type SchoolStorage = {
  profile: StorageProfile
  storage: MediaStoragePort
}

/**
 * The storage one school's bytes go through, opened per request.
 *
 * A file is always reached through the profile that wrote it rather than the
 * school's current one: a school that changes bucket keeps everything it has
 * already published readable, and only new uploads follow the new keys.
 */
@Injectable()
export class SchoolStorageService {
  constructor(
    @Inject(MEDIA_STORAGE) private readonly storages: MediaStorageFactory,
    private readonly profiles: StorageProfilesService,
    private readonly sealing: SecretSealingService,
  ) {}

  async openCurrent(schoolId: SchoolId): Promise<SchoolStorage> {
    const profile = await this.profiles.findCurrentFor(schoolId)
    if (!profile) throw new StorageFailedError('not-configured')

    return this.openProfile(profile)
  }

  /** The bucket one file was written into, whether or not the school still uses it. */
  async openProfileById(profileId: StorageProfileId): Promise<SchoolStorage> {
    const profile = await this.profiles.findById(profileId)
    if (!profile) throw new StorageFailedError('not-configured')

    return this.openProfile(profile)
  }

  openProfile(profile: StorageProfile): SchoolStorage {
    return { profile, storage: this.storages.openStorage(this.credentialsOf(profile)) }
  }

  private credentialsOf(profile: StorageProfile): StorageCredentials {
    return {
      endpoint: profile.endpoint,
      region: profile.region,
      bucket: profile.bucket,
      prefix: profile.prefix,
      accessKeyId: profile.accessKeyId,
      secret: this.sealing.openSecret(profile, {
        schoolId: profile.schoolId as SchoolId,
        profileId: profile.id,
      }),
    }
  }
}
