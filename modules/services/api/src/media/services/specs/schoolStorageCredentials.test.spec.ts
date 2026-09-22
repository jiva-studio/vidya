import { StorageProfile } from '@vidya/entities'

import { MediaStorageFactory, StorageCredentials } from '../../infra/ports'
import { InstallationStorageService } from '../installationStorage.service'
import { SchoolStorageService } from '../schoolStorage.service'
import { SecretSealingService } from '../secretSealing.service'
import { StorageProfilesService } from '../storageProfiles.service'

const profile = (): StorageProfile =>
  ({
    id: 'profile',
    schoolId: 'school',
    endpoint: 'https://storage.invalid',
    region: 'us-east-1',
    bucket: 'vidya-demo',
    prefix: 'school/one',
    accessKeyId: 'key',
    delivery: 'bunny-token',
  }) as unknown as StorageProfile

/** A factory that keeps what it was handed instead of opening anything. */
const recordingFactory = () => {
  const opened: StorageCredentials[] = []

  const storages: MediaStorageFactory = {
    openStorage(credentials: StorageCredentials) {
      opened.push(credentials)
      return {} as ReturnType<MediaStorageFactory['openStorage']>
    },
  }

  return { opened, storages }
}

const sealing = { openSecret: () => 'secret' } as unknown as SecretSealingService

describe("the credentials a school's bucket is opened with", () => {
  it('carries the way the profile delivers reads, which decides what may be signed', () => {
    const { opened, storages } = recordingFactory()
    const service = new SchoolStorageService(
      storages,
      {} as InstallationStorageService,
      {} as StorageProfilesService,
      sealing,
    )

    service.openProfile(profile())

    expect(opened).toHaveLength(1)
    expect(opened[0].delivery).toBe('bunny-token')
  })
})
