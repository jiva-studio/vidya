import { randomUUID } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { MediaConfig } from '@vidya/api/configs'
import { hasOwnCredentials, toMediaRecord } from '@vidya/api/media/mappers'
import { MediaId, StoredObject, UserId } from '@vidya/domain'
import { Media, StorageProfile } from '@vidya/entities'
import * as protocol from '@vidya/protocol'

import { MediaRefusedError } from '../mediaRefusal'
import { defaultPrefixOf, isAllowedMimeType, maxBytesOf, storageKeyOf } from './mediaLimits'
import { MediaRowsService } from './mediaRows.service'
import { MediaUsageService } from './mediaUsage.service'
import { SchoolStorage, SchoolStorageService } from './schoolStorage.service'
import { quotaBytesFor, StorageQuotasService } from './storageQuotas.service'

/**
 * Signing one upload and believing storage about what landed.
 *
 * Nothing the client says about the bytes survives this service: the size and
 * the type it declares bind the signature and are then re-read from storage,
 * and a row whose object turns out to be something else is failed rather than
 * corrected. The quota is refused here, at the signature, because refusing it
 * after two gigabytes have been uploaded is not a refusal anybody can act on.
 */
@Injectable()
export class MediaUploadsService {
  constructor(
    @Inject(MediaConfig.KEY) private readonly config: ConfigType<typeof MediaConfig>,
    private readonly quotas: StorageQuotasService,
    private readonly rows: MediaRowsService,
    private readonly storages: SchoolStorageService,
    private readonly usage: MediaUsageService,
  ) {}

  async findMedia(mediaId: MediaId): Promise<Media | null> {
    return this.rows.findById(mediaId)
  }

  async signUpload(
    request: protocol.CreateUploadRequest,
    createdBy: UserId,
  ): Promise<protocol.CreateUploadResponse> {
    this.assertUploadable(request)

    const opened = await this.storages.openCurrent(request.schoolId)
    await this.assertRoomFor(request, opened.profile)

    const mediaId = randomUUID() as MediaId
    const prefix = opened.profile.prefix || defaultPrefixOf(request.schoolId)
    const storageKey = storageKeyOf(prefix, request.kind, mediaId, request.mimeType)

    await this.rows.createPending({
      id: mediaId,
      schoolId: request.schoolId,
      profileId: opened.profile.id,
      kind: request.kind,
      storageKey,
      name: request.name,
      mimeType: request.mimeType,
      sizeBytes: request.sizeBytes,
      createdBy,
    })

    const deduplicated = this.isDeduplicated(request)

    return {
      mediaId,
      deduplicated,
      grant: await opened.storage.signUpload(storageKey, {
        contentType: request.mimeType,
        sizeBytes: request.sizeBytes,
        sha256: deduplicated ? request.sha256 : undefined,
      }),
    }
  }

  async completeUpload(media: Media, declared?: string): Promise<protocol.MediaRecord> {
    if (media.status === 'ready') return toMediaRecord(media)
    if (media.status !== 'pending') throw new MediaRefusedError('not-ready')

    const opened = await this.storages.openProfileById(media.profileId)
    const stored = await opened.storage.head(media.storageKey)

    if (!stored) throw new MediaRefusedError('not-ready')
    if (!this.matchesGrant(media, stored)) await this.refuseObject(media, opened)

    const digest = this.digestOf(stored, declared)
    const held = digest ? await this.rows.findReadyByDigest(media.schoolId, digest) : null

    if (held) return this.dropCopy(media, opened, held)

    const ready = await this.rows.markReady(media, {
      sizeBytes: stored.sizeBytes,
      mimeType: stored.contentType,
      sha256: digest,
    })

    return toMediaRecord(ready)
  }

  private assertUploadable(request: protocol.CreateUploadRequest): void {
    if (!isAllowedMimeType(request.kind, request.mimeType)) {
      throw new MediaRefusedError('type-not-allowed')
    }

    if (request.sizeBytes > maxBytesOf(this.config, request.kind)) {
      throw new MediaRefusedError('too-large')
    }
  }

  /**
   * Room for this file, counting what is stored and what outstanding grants
   * already promised.
   *
   * Without the reservation ten parallel grants each pass on their own and
   * overfill the bucket together, and the school finds out from its provider
   * rather than from us.
   */
  private async assertRoomFor(
    request: protocol.CreateUploadRequest,
    profile: StorageProfile,
  ): Promise<void> {
    const quotaBytes = quotaBytesFor(
      await this.quotas.findQuotaBytes(request.schoolId),
      hasOwnCredentials(profile),
      this.config.defaultQuotaBytes,
    )

    if (quotaBytes === null) return

    const stored = await this.usage.usedBytesOf(request.schoolId)
    const reserved = await this.usage.reservedBytesOf(request.schoolId)

    if (stored + reserved + request.sizeBytes > quotaBytes) {
      throw new MediaRefusedError('quota-exceeded')
    }
  }

  /** Above the hashing limit the browser is not asked for a digest, so nothing matches. */
  private isDeduplicated(request: protocol.CreateUploadRequest): boolean {
    return Boolean(request.sha256) && request.sizeBytes <= this.config.hashLimitBytes
  }

  /**
   * The digest this file is deduplicated by, or nothing above the hashing
   * limit — the grant promised no deduplication for those, and a digest that
   * arrives anyway does not release us from what was promised.
   */
  private digestOf(stored: StoredObject, declared?: string): string | null {
    if (stored.sizeBytes > this.config.hashLimitBytes) return null

    return stored.sha256 ?? declared ?? null
  }

  private matchesGrant(media: Media, stored: StoredObject): boolean {
    return stored.sizeBytes === Number(media.sizeBytes) && stored.contentType === media.mimeType
  }

  private async refuseObject(media: Media, opened: SchoolStorage): Promise<never> {
    await this.rows.markFailed(media.id)
    await opened.storage.remove(media.storageKey)

    throw new MediaRefusedError('not-ready')
  }

  /** The school already holds these bytes, so the second copy is the one that goes. */
  private async dropCopy(
    media: Media,
    opened: SchoolStorage,
    held: Media,
  ): Promise<protocol.MediaRecord> {
    await opened.storage.remove(media.storageKey)
    await this.rows.deleteRow(media.id)

    return toMediaRecord(held)
  }
}
