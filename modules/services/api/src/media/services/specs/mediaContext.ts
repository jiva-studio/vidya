import { randomUUID } from 'node:crypto'

import { Test } from '@nestjs/testing'
import { MediaConfig } from '@vidya/api/configs'
import { testingDataSource } from '@vidya/api/shared/datasources'
import { MediaStoragePort, SchoolId, StorageProfileId, UserId } from '@vidya/domain'
import { School, StorageProfile, User } from '@vidya/entities'
import { DataSource } from 'typeorm'

import { MediaCatalogService } from '../mediaCatalog.service'
import { MediaRowsService } from '../mediaRows.service'
import { MediaSweepService } from '../mediaSweep.service'
import { MediaUploadsService } from '../mediaUploads.service'
import { MediaUsageService } from '../mediaUsage.service'
import { SchoolStorage, SchoolStorageService } from '../schoolStorage.service'
import { StorageQuotasService } from '../storageQuotas.service'

export type MediaServices = {
  ds: DataSource
  schoolId: SchoolId
  userId: UserId
  profile: StorageProfile
  catalog: MediaCatalogService
  rows: MediaRowsService
  uploads: MediaUploadsService
  sweep: MediaSweepService
  usage: MediaUsageService

  /** A second live profile, for the cases where two buckets are swept at once. */
  addProfile(prefix: string): Promise<StorageProfile>

  close(): Promise<void>
}

/**
 * The media services over a pg-mem database, with storage handed in.
 *
 * Built through the container rather than by calling constructors, so a service
 * that gains a dependency does not take every suite that arranges it with it.
 * The storage a school's files go through is the one argument: a suite hands in
 * a recording port, or the stand's live bucket.
 */
export const createMediaServices = async (options: {
  storage: MediaStoragePort
  prefix?: string
}): Promise<MediaServices> => {
  const ds = await testingDataSource()

  const school = await ds.getRepository(School).save({ name: 'One', config: {} } as School)
  const user = await ds.getRepository(User).save({ email: `${randomUUID()}@example.com` } as User)

  const saveProfile = async (prefix: string): Promise<StorageProfile> =>
    ds.getRepository(StorageProfile).save({
      schoolId: school.id,
      provider: 's3-compatible',
      endpoint: 'https://de-s3.storage.bunnycdn.com',
      r2AccountId: null,
      region: 'de',
      bucket: 'vidya-demo',
      prefix,
      accessKeyId: 'vidya-demo',
      secrets: {
        keyVersion: 1,
        dek: { ciphertext: 'c2VhbGVkLWRlaw==', nonce: 'ZGVrLW5vbmNl' },
        secret: { ciphertext: 'c2VhbGVk', nonce: 'bm9uY2U=' },
        tokenSecret: null,
      },
      delivery: 'presigned',
      publicBaseUrl: null,
      verifiedAt: new Date(),
      verifyError: null,
      retiredAt: null,
    } as StorageProfile)

  const profile = await saveProfile(options.prefix ?? `school/${school.id}`)
  const profiles = new Map<StorageProfileId, StorageProfile>([[profile.id, profile]])

  const opened = (found: StorageProfile): SchoolStorage => ({
    profile: found,
    storage: options.storage,
  })

  const storages = {
    openCurrent: async () => opened(profile),
    openProfileById: async (profileId: StorageProfileId) =>
      opened(profiles.get(profileId) ?? profile),
    openProfile: (found: StorageProfile) => opened(found),
  } as unknown as SchoolStorageService

  const module = await Test.createTestingModule({
    providers: [
      MediaCatalogService,
      MediaRowsService,
      MediaSweepService,
      MediaUploadsService,
      MediaUsageService,
      StorageQuotasService,
      { provide: DataSource, useValue: ds },
      { provide: MediaConfig.KEY, useValue: MediaConfig() },
      { provide: SchoolStorageService, useValue: storages },
    ],
  }).compile()

  return {
    ds,
    schoolId: school.id as SchoolId,
    userId: user.id as UserId,
    profile,
    catalog: module.get(MediaCatalogService),
    rows: module.get(MediaRowsService),
    uploads: module.get(MediaUploadsService),
    sweep: module.get(MediaSweepService),
    usage: module.get(MediaUsageService),

    async addProfile(prefix) {
      const added = await saveProfile(prefix)
      profiles.set(added.id as StorageProfileId, added)
      return added
    },

    async close() {
      await module.close()
      await ds.destroy()
    },
  }
}
