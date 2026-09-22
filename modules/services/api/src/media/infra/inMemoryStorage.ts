import { Injectable } from '@nestjs/common'
import {
  MediaKind,
  MediaStoragePort,
  ReadWindowSeconds,
  SignedUrl,
  StoredObject,
  toIsoDateTime,
  UploadGrant,
  UploadLimits,
} from '@vidya/domain'

import { StorageFailedError } from '../storageFailure'
import { acceptedCredentials } from './fixtureCredentials'
import { MediaStorageFactory, SignedHttpPort, StorageCredentials } from './ports'

export type StorageCall = {
  op: 'signUpload' | 'write' | 'head' | 'signRead' | 'signStream' | 'readRange' | 'remove' | 'list'
  key: string
  accessKeyId: string
}

const UPLOAD_WINDOW_SECONDS = 900

const addressOf = (credentials: StorageCredentials, key: string): string => {
  const query = new URLSearchParams({
    keyId: credentials.accessKeyId,
    sig: credentials.secret,
  })
  return `memory://${credentials.bucket}/${key}?${query.toString()}`
}

const expiryIn = (seconds: number) => toIsoDateTime(new Date(Date.now() + seconds * 1000))

/**
 * Storage without a bucket behind it, for the suites that test what the API
 * does rather than what S3 does.
 *
 * It refuses any secret but the one the wire fixtures carry, which is the whole
 * point: without that, working keys and a wrong secret are the same thing in
 * memory and neither outcome can be asked for. Every call is written into
 * `calls`, so the order a probe visits storage in — write, head, read back,
 * delete — is observable, and so is an address we refused to dial, by the
 * absence of any call at all.
 */
@Injectable()
export class InMemoryStorage implements MediaStorageFactory, SignedHttpPort {
  readonly calls: StorageCall[] = []

  private readonly objects = new Map<string, StoredObject & { body: Buffer }>()

  openStorage(credentials: StorageCredentials): MediaStoragePort {
    return new InMemoryStorageDriver(this, credentials)
  }

  async writeByGrant(grant: UploadGrant, body: Buffer): Promise<void> {
    const { bucket, key, accessKeyId } = this.readAddress(grant.url)
    this.record('write', key, accessKeyId)

    this.objects.set(`${bucket}/${key}`, {
      key,
      body,
      sizeBytes: body.length,
      contentType: grant.headers['Content-Type'] ?? 'application/octet-stream',
    })
  }

  async readRange(url: string, lengthBytes: number): Promise<Buffer> {
    const { bucket, key, accessKeyId } = this.readAddress(url)
    this.record('readRange', key, accessKeyId)

    const stored = this.objects.get(`${bucket}/${key}`)
    if (!stored) throw new StorageFailedError('unreachable')

    return stored.body.subarray(0, lengthBytes)
  }

  record(op: StorageCall['op'], key: string, accessKeyId: string): void {
    this.calls.push({ op, key, accessKeyId })
  }

  objectAt(bucket: string, key: string): (StoredObject & { body: Buffer }) | undefined {
    return this.objects.get(`${bucket}/${key}`)
  }

  forget(bucket: string, key: string): void {
    this.objects.delete(`${bucket}/${key}`)
  }

  keysUnder(bucket: string, prefix: string): StoredObject[] {
    return [...this.objects.entries()]
      .filter(([at]) => at.startsWith(`${bucket}/${prefix}`))
      .map(([, stored]) => stored)
  }

  /**
   * The credentials carried by a signed address, refusing the ones storage
   * would refuse. A wrong secret is caught here rather than at signing time
   * because that is where a real provider catches it: presigning is local
   * arithmetic and succeeds with any key at all.
   */
  private readAddress(url: string): { bucket: string; key: string; accessKeyId: string } {
    const parsed = new URL(url)
    const accepted = acceptedCredentials()
    const accessKeyId = parsed.searchParams.get('keyId') ?? ''
    const signature = parsed.searchParams.get('sig') ?? ''

    if (accessKeyId !== accepted.accessKeyId || signature !== accepted.secret) {
      throw new StorageFailedError('credentials-rejected')
    }

    return { bucket: parsed.host, key: parsed.pathname.replace(/^\//, ''), accessKeyId }
  }
}

class InMemoryStorageDriver implements MediaStoragePort {
  constructor(
    private readonly store: InMemoryStorage,
    private readonly credentials: StorageCredentials,
  ) {}

  async signUpload(key: string, limits: UploadLimits): Promise<UploadGrant> {
    this.store.record('signUpload', key, this.credentials.accessKeyId)

    return {
      method: 'put',
      url: addressOf(this.credentials, key),
      headers: {
        'Content-Type': limits.contentType,
        'Content-Length': String(limits.sizeBytes),
      },
      fields: {},
      expiresAt: expiryIn(UPLOAD_WINDOW_SECONDS),
    }
  }

  async signRead(key: string, kind: MediaKind): Promise<SignedUrl> {
    this.store.record('signRead', key, this.credentials.accessKeyId)

    return {
      url: addressOf(this.credentials, key),
      expiresAt: expiryIn(ReadWindowSeconds[kind]),
    }
  }

  async signStream(prefix: string, kind: MediaKind): Promise<SignedUrl> {
    this.store.record('signStream', prefix, this.credentials.accessKeyId)

    return {
      url: addressOf(this.credentials, prefix),
      expiresAt: expiryIn(ReadWindowSeconds[kind]),
    }
  }

  async head(key: string): Promise<StoredObject | undefined> {
    this.assertCredentials()
    this.store.record('head', key, this.credentials.accessKeyId)

    return this.store.objectAt(this.credentials.bucket, key)
  }

  async remove(key: string): Promise<void> {
    this.assertCredentials()
    this.store.record('remove', key, this.credentials.accessKeyId)
    this.store.forget(this.credentials.bucket, key)
  }

  async *listPrefix(prefix: string): AsyncIterable<StoredObject> {
    this.assertCredentials()
    this.store.record('list', prefix, this.credentials.accessKeyId)

    for (const stored of this.store.keysUnder(this.credentials.bucket, prefix)) yield stored
  }

  async *listUnfinished(): AsyncIterable<{ key: string; uploadId: string; startedAt: Date }> {
    // Nothing in memory is ever half-written: a grant either lands as a whole
    // object or leaves nothing behind, so there is no session to abort.
  }

  async abortUnfinished(): Promise<void> {
    // See `listUnfinished`: there is never a session for this to end.
  }

  private assertCredentials(): void {
    const accepted = acceptedCredentials()

    if (
      this.credentials.accessKeyId !== accepted.accessKeyId ||
      this.credentials.secret !== accepted.secret
    ) {
      throw new StorageFailedError('credentials-rejected')
    }
  }
}
