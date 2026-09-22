import { randomUUID } from 'node:crypto'

import { MediaStoragePort, UploadGrant } from '@vidya/domain'

import { FetchSignedHttp } from '../../infra/fetchSignedHttp'
import { MediaStorageFactory, SignedHttpPort, StorageCredentials } from '../../infra/ports'
import { openStandStorage, removeAllUnder, standCredentials } from '../../infra/specs/stand'
import { StorageProbeService } from '../storageProbe.service'

/** Records which calls the probe makes, in the order it makes them. */
const journalling = (storage: MediaStoragePort, journal: string[]): MediaStoragePort =>
  new Proxy(storage, {
    get: (target, name: string) => {
      const value = Reflect.get(target, name)
      if (typeof value !== 'function') return value

      return (...args: unknown[]) => {
        journal.push(name)
        return (value as (...a: unknown[]) => unknown).apply(target, args)
      }
    },
  })

class JournallingHttp implements SignedHttpPort {
  private readonly real = new FetchSignedHttp()

  constructor(private readonly journal: string[]) {}

  async writeByGrant(grant: UploadGrant, body: Buffer): Promise<void> {
    this.journal.push('writeByGrant')
    await this.real.writeByGrant(grant, body)
  }

  async readRange(url: string, lengthBytes: number): Promise<Buffer> {
    this.journal.push('readRange')
    return this.real.readRange(url, lengthBytes)
  }
}

describe('proving storage credentials against live storage', () => {
  let credentials: StorageCredentials
  let storage: MediaStoragePort
  let journal: string[]
  let probe: StorageProbeService

  beforeEach(() => {
    credentials = standCredentials(`storage-spec/${randomUUID()}`)
    storage = openStandStorage(credentials)
    journal = []

    const factory: MediaStorageFactory = { openStorage: () => journalling(storage, journal) }
    probe = new StorageProbeService(factory, new JournallingHttp(journal))
  })

  afterEach(async () => {
    await removeAllUnder(storage, credentials.prefix)
  })

  it('writes, heads, reads a range and deletes, in that order', async () => {
    await probe.probeCredentials(credentials)

    expect(journal).toEqual([
      'signUpload',
      'writeByGrant',
      'head',
      'signRead',
      'readRange',
      'remove',
    ])
  })

  it('leaves no probe object behind in the bucket', async () => {
    await probe.probeCredentials(credentials)

    const left: string[] = []
    for await (const object of storage.listPrefix(credentials.prefix)) left.push(object.key)

    expect(left).toEqual([])
    await expect(storage.head(`${credentials.prefix}/.vidya-probe`)).resolves.toBeUndefined()
  })

  it('refuses credentials whose secret is wrong', async () => {
    const wrong = { ...credentials, secret: 'not-the-stand-secret' }
    const plain: MediaStorageFactory = { openStorage: (c) => openStandStorage(c) }
    const strict = new StorageProbeService(plain, new FetchSignedHttp())

    await expect(strict.probeCredentials(wrong)).rejects.toMatchObject({
      failure: 'credentials-rejected',
    })
  })
})
