import { Inject, Injectable } from '@nestjs/common'

import {
  MEDIA_SIGNED_HTTP,
  MEDIA_STORAGE,
  MediaStorageFactory,
  SignedHttpPort,
  StorageCredentials,
} from '../infra/ports'
import { StorageFailedError } from '../storageFailure'

const PROBE_OBJECT = '.vidya-probe'
const PROBE_BODY = Buffer.from('vidya storage probe', 'utf8')

const probeKeyFor = (prefix: string): string =>
  [prefix.replace(/\/+$/, ''), PROBE_OBJECT].filter((part) => part.length > 0).join('/')

/**
 * Proves a school's credentials by using them the way the product does.
 *
 * The probe writes through a grant issued exactly as a browser's is, then
 * heads the object, reads it back by range and deletes it. Anything narrower —
 * a bare `ListBuckets`, a HEAD on the bucket — would prove a path nobody
 * uploads or plays through, and would keep passing after the one that matters
 * had stopped working.
 */
@Injectable()
export class StorageProbeService {
  constructor(
    @Inject(MEDIA_STORAGE) private readonly storages: MediaStorageFactory,
    @Inject(MEDIA_SIGNED_HTTP) private readonly http: SignedHttpPort,
  ) {}

  async probeCredentials(credentials: StorageCredentials): Promise<void> {
    const storage = this.storages.openStorage(credentials)
    const key = probeKeyFor(credentials.prefix)

    const grant = await storage.signUpload(key, {
      contentType: 'application/octet-stream',
      sizeBytes: PROBE_BODY.length,
    })

    await this.http.writeByGrant(grant, PROBE_BODY, credentials.addresses)

    const stored = await storage.head(key)
    if (!stored) throw new StorageFailedError('unreachable')

    const signed = await storage.signRead(key, 'image')
    await this.http.readRange(signed.url, PROBE_BODY.length, credentials.addresses)

    await storage.remove(key)
  }
}
