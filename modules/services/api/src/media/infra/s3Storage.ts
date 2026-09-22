import { Agent as HttpAgent } from 'node:http'
import { Agent as HttpsAgent } from 'node:https'

import {
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Inject, Injectable } from '@nestjs/common'
import { CLOCK, Clock, systemClock } from '@vidya/api/shared/clock'
import {
  MediaKind,
  MediaStoragePort,
  ReadWindowSeconds,
  SignedUrl,
  StoredObject,
  toIsoDateTime,
  UploadGrant,
  UploadLimits,
  windowExpiry,
} from '@vidya/domain'

import { isAllowedMimeType, mimeTypeOfKey } from '../services/mediaLimits'
import { pinnedLookup } from './pinnedAddresses'
import { MediaStorageFactory, StorageCredentials } from './ports'
import { refuseStreamSigning } from './streamSigning'

const UPLOAD_WINDOW_SECONDS = 900

/** What a type nobody may be shown is served as, whatever the object claims. */
const OPAQUE_TYPE = 'application/octet-stream'

/**
 * Connects to the addresses the endpoint check approved, where it approved any.
 *
 * Resolving the host again here would undo the check: the school owns the name
 * and can point it somewhere else between the approval and the request.
 */
const agentsFor = (addresses: string[]) => {
  const lookup = pinnedLookup(addresses)

  return {
    httpAgent: new HttpAgent({ lookup }),
    httpsAgent: new HttpsAgent({ lookup }),
  }
}

const clientFor = (credentials: StorageCredentials): S3Client =>
  new S3Client({
    endpoint: credentials.endpoint,
    region: credentials.region || 'us-east-1',
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secret,
    },
    // Bunny, MinIO and R2 all address a bucket by path; virtual-host style
    // would put the bucket in a hostname none of them serve.
    forcePathStyle: true,
    ...(credentials.addresses?.length ? { requestHandler: agentsFor(credentials.addresses) } : {}),
  })

const expiryIn = (nowMs: number, seconds: number) => toIsoDateTime(new Date(nowMs + seconds * 1000))

/**
 * What the browser is told to do with the bytes it is about to be handed.
 *
 * Only a type from the upload white list is shown in place. Everything else is
 * handed down as a file to save and stripped of its type on the way out,
 * because an SVG is a document a browser executes: served inline from a host
 * the school's operators are signed into, one upload becomes a script tag.
 */
const responseHeadersFor = (
  key: string,
  kind: MediaKind,
  mimeType: string | undefined,
): { ResponseContentDisposition: string; ResponseContentType?: string } => {
  const declared = mimeType ?? mimeTypeOfKey(key)

  if (declared && isAllowedMimeType(kind, declared)) {
    return { ResponseContentDisposition: 'inline', ResponseContentType: declared }
  }

  return { ResponseContentDisposition: 'attachment', ResponseContentType: OPAQUE_TYPE }
}

/** Whether the error means the object is absent rather than unreachable. */
const isMissing = (error: unknown): boolean => {
  const name = (error as { name?: string }).name
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode

  return name === 'NotFound' || name === 'NoSuchKey' || status === 404
}

/** Opens S3-compatible storage: AWS, Bunny, R2, Wasabi and MinIO are one driver. */
@Injectable()
export class S3StorageFactory implements MediaStorageFactory {
  // Defaulted so a suite can open the port with `new S3StorageFactory()`; the
  // application always has the clock the rest of it is stamped from.
  constructor(@Inject(CLOCK) private readonly clock: Clock = systemClock) {}

  openStorage(credentials: StorageCredentials): MediaStoragePort {
    return new S3Storage(credentials, this.clock)
  }
}

class S3Storage implements MediaStoragePort {
  private readonly client: S3Client

  constructor(
    private readonly credentials: StorageCredentials,
    private readonly clock: Clock,
  ) {
    this.client = clientFor(credentials)
  }

  /**
   * A presigned PUT carries no conditions of its own, so size and type are
   * bound by signing their headers: the upload then only works for exactly the
   * length and type that were declared, and a grant stops being a licence to
   * write anything at all.
   */
  async signUpload(key: string, limits: UploadLimits): Promise<UploadGrant> {
    const headers: Record<string, string> = {
      'Content-Type': limits.contentType,
      'Content-Length': String(limits.sizeBytes),
    }

    if (limits.sha256) headers['x-amz-checksum-sha256'] = limits.sha256

    const command = new PutObjectCommand({
      Bucket: this.credentials.bucket,
      Key: key,
      ContentType: limits.contentType,
      ContentLength: limits.sizeBytes,
      ChecksumSHA256: limits.sha256,
    })

    const url = await getSignedUrl(this.client, command, {
      expiresIn: UPLOAD_WINDOW_SECONDS,
      signableHeaders: new Set(Object.keys(headers).map((name) => name.toLowerCase())),
    })

    return {
      method: 'put',
      url,
      headers,
      fields: {},
      expiresAt: expiryIn(this.clock.nowMs(), UPLOAD_WINDOW_SECONDS),
    }
  }

  /**
   * Signed from the start of the window the clock is in rather than from now, so
   * that every reader inside that window is handed the same bytes of address.
   *
   * `X-Amz-Date` and `X-Amz-Expires` are both in the query string, so signing
   * at "now, for an hour" mints a different address every second and a CDN and
   * a browser hold a separate copy per view. The window's own start is in the
   * past at every instant of it, which is what a signature needs — storage
   * refuses one dated ahead of its clock — while the expiry may be carried a
   * window further on, so the life signed for is measured to it rather than
   * assumed to be one window.
   */
  async signRead(key: string, kind: MediaKind, mimeType?: string): Promise<SignedUrl> {
    const window = ReadWindowSeconds[kind] * 1000
    const nowMs = this.clock.nowMs()
    const expiresAtMs = windowExpiry(nowMs, ReadWindowSeconds[kind])
    const signedFromMs = Math.floor(nowMs / window) * window

    const command = new GetObjectCommand({
      Bucket: this.credentials.bucket,
      Key: key,
      ...responseHeadersFor(key, kind, mimeType),
    })

    const url = await getSignedUrl(this.client, command, {
      expiresIn: (expiresAtMs - signedFromMs) / 1000,
      signingDate: new Date(signedFromMs),
    })

    return { url, expiresAt: toIsoDateTime(new Date(expiresAtMs)) }
  }

  async signStream(): Promise<SignedUrl> {
    return refuseStreamSigning(this.credentials.delivery)
  }

  async head(key: string): Promise<StoredObject | undefined> {
    try {
      // `ChecksumMode` is what makes a stored checksum readable back: without it
      // the answer carries no `ChecksumSHA256` at all, whatever was verified on
      // the way in, and the port would report every object as unhashed.
      const found = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.credentials.bucket,
          Key: key,
          ChecksumMode: 'ENABLED',
        }),
      )

      return {
        key,
        sizeBytes: found.ContentLength ?? 0,
        contentType: found.ContentType ?? 'application/octet-stream',
        sha256: found.ChecksumSHA256,
      }
    } catch (error) {
      // An object that is not there is an answer, not a fault: the port says so
      // with nothing. Anything else — refused keys, a bucket that is gone — is
      // the caller's to see.
      if (isMissing(error)) return undefined

      throw error
    }
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.credentials.bucket, Key: key }))
  }

  async *listPrefix(prefix: string): AsyncIterable<StoredObject> {
    let token: string | undefined

    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.credentials.bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      )

      for (const entry of page.Contents ?? []) {
        yield {
          key: entry.Key ?? '',
          sizeBytes: entry.Size ?? 0,
          contentType: 'application/octet-stream',
        }
      }

      token = page.NextContinuationToken
    } while (token)
  }

  async *listUnfinished(
    prefix: string,
  ): AsyncIterable<{ key: string; uploadId: string; startedAt: Date }> {
    // Listed without `Prefix` and filtered here: MinIO answers a prefixed
    // `ListMultipartUploads` with nothing at all, so a prefixed call would
    // report every zone as having no unfinished sessions — the exact case this
    // exists to find. The filter is ours; the paging is the provider's.
    let marker: { key?: string; uploadId?: string } = {}

    do {
      const page = await this.client.send(
        new ListMultipartUploadsCommand({
          Bucket: this.credentials.bucket,
          KeyMarker: marker.key,
          UploadIdMarker: marker.uploadId,
        }),
      )

      for (const upload of page.Uploads ?? []) {
        const key = upload.Key ?? ''
        if (!key.startsWith(prefix)) continue

        yield {
          key,
          uploadId: upload.UploadId ?? '',
          startedAt: upload.Initiated ?? new Date(0),
        }
      }

      marker = page.IsTruncated
        ? { key: page.NextKeyMarker, uploadId: page.NextUploadIdMarker }
        : {}
    } while (marker.key !== undefined)
  }

  async abortUnfinished(key: string, uploadId: string): Promise<void> {
    await this.client.send(
      new AbortMultipartUploadCommand({
        Bucket: this.credentials.bucket,
        Key: key,
        UploadId: uploadId,
      }),
    )
  }
}
